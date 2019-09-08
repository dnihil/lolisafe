const { promisify } = require('util')
const config = require('./../config')
const db = require('knex')(config.database)
const fetch = require('node-fetch')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const logger = require('./../logger')
const path = require('path')
const paths = require('./pathsController')
const perms = require('./permissionController')
const sharp = require('sharp')
const si = require('systeminformation')

const self = {
  clamd: {
    scanner: null,
    timeout: config.uploads.scan.timeout || 5000,
    chunkSize: config.uploads.scan.chunkSize || 64 * 1024
  },
  gitHash: null,
  idSet: null,

  idMaxTries: config.uploads.maxTries || 1,

  imageExts: ['.webp', '.jpg', '.jpeg', '.gif', '.png', '.tiff', '.tif', '.svg'],
  videoExts: ['.webm', '.mp4', '.wmv', '.avi', '.mov', '.mkv'],

  ffprobe: promisify(ffmpeg.ffprobe)
}

const statsCache = {
  system: {
    cache: null,
    generating: false
  },
  albums: {
    cache: null,
    generating: false,
    generatedAt: 0,
    invalidatedAt: 0
  },
  users: {
    cache: null,
    generating: false,
    generatedAt: 0,
    invalidatedAt: 0
  },
  uploads: {
    cache: null,
    generating: false,
    generatedAt: 0,
    invalidatedAt: 0
  }
}

const cloudflareAuth = config.cloudflare.apiKey && config.cloudflare.email && config.cloudflare.zoneId

self.mayGenerateThumb = extname => {
  return (config.uploads.generateThumbs.image && self.imageExts.includes(extname)) ||
    (config.uploads.generateThumbs.video && self.videoExts.includes(extname))
}

// Expand if necessary (must be lower case); for now only preserves some known tarballs
const extPreserves = ['.tar.gz', '.tar.z', '.tar.bz2', '.tar.lzma', '.tar.lzo', '.tar.xz']

self.extname = filename => {
  // Always return blank string if the filename does not seem to have a valid extension
  // Files such as .DS_Store (anything that starts with a dot, without any extension after) will still be accepted
  if (!/\../.test(filename)) return ''

  let lower = filename.toLowerCase() // due to this, the returned extname will always be lower case
  let multi = ''
  let extname = ''

  // check for multi-archive extensions (.001, .002, and so on)
  if (/\.\d{3}$/.test(lower)) {
    multi = lower.slice(lower.lastIndexOf('.') - lower.length)
    lower = lower.slice(0, lower.lastIndexOf('.'))
  }

  // check against extensions that must be preserved
  for (const extPreserve of extPreserves)
    if (lower.endsWith(extPreserve)) {
      extname = extPreserve
      break
    }

  if (!extname)
    extname = lower.slice(lower.lastIndexOf('.') - lower.length) // path.extname(lower)

  return extname + multi
}

self.escape = (string) => {
  // MIT License
  // Copyright(c) 2012-2013 TJ Holowaychuk
  // Copyright(c) 2015 Andreas Lubbe
  // Copyright(c) 2015 Tiancheng "Timothy" Gu

  if (!string)
    return string

  const str = String(string)
  const match = /["'&<>]/.exec(str)

  if (!match)
    return str

  let escape
  let html = ''
  let index = 0
  let lastIndex = 0

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 39: // '
        escape = '&#39;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }

    if (lastIndex !== index)
      html += str.substring(lastIndex, index)

    lastIndex = index + 1
    html += escape
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html
}

self.authorize = async (req, res) => {
  // TODO: Improve usage of this function by the other APIs
  const token = req.headers.token
  if (token === undefined) {
    res.status(401).json({ success: false, description: 'No token provided.' })
    return
  }

  try {
    const user = await db.table('users')
      .where('token', token)
      .first()
    if (user) {
      if (user.enabled === false || user.enabled === 0) {
        res.json({ success: false, description: 'This account has been disabled.' })
        return
      }
      return user
    }

    res.status(401).json({ success: false, description: 'Invalid token.' })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, description: 'An unexpected error occurred. Try again?' })
  }
}

self.generateThumbs = async (name, extname, force) => {
  const thumbname = path.join(paths.thumbs, name.slice(0, -extname.length) + '.png')

  try {
    // Check if thumbnail already exists
    try {
      const lstat = await paths.lstat(thumbname)
      if (lstat.isSymbolicLink())
        // Unlink if symlink (should be symlink to the placeholder)
        await paths.unlink(thumbname)
      else if (!force)
        // Continue only if it does not exist, unless forced to
        return true
    } catch (error) {
      // Re-throw error
      if (error.code !== 'ENOENT')
        throw error
    }

    // Full path to input file
    const input = path.join(paths.uploads, name)

    // If image extension
    if (self.imageExts.includes(extname)) {
      const resizeOptions = {
        width: 200,
        height: 200,
        fit: 'contain',
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0
        }
      }
      const image = sharp(input)
      const metadata = await image.metadata()
      if (metadata.width > resizeOptions.width || metadata.height > resizeOptions.height) {
        await image
          .resize(resizeOptions)
          .toFile(thumbname)
      } else if (metadata.width === resizeOptions.width && metadata.height === resizeOptions.height) {
        await image
          .toFile(thumbname)
      } else {
        const x = resizeOptions.width - metadata.width
        const y = resizeOptions.height - metadata.height
        await image
          .extend({
            top: Math.floor(y / 2),
            bottom: Math.ceil(y / 2),
            left: Math.floor(x / 2),
            right: Math.ceil(x / 2),
            background: resizeOptions.background
          })
          .toFile(thumbname)
      }
    } else if (self.videoExts.includes(extname)) {
      const metadata = await self.ffprobe(input)

      // Skip files that do not have video streams/channels
      if (!metadata.streams || !metadata.streams.some(s => s.codec_type === 'video'))
        throw 'File does not contain any video stream'

      await new Promise((resolve, reject) => {
        ffmpeg(input)
          .inputOptions([
              `-ss ${parseInt(metadata.format.duration) * 20 / 100}`
          ])
          .output(thumbname)
          .outputOptions([
            '-vframes 1',
            '-vf scale=200:200:force_original_aspect_ratio=decrease'
          ])
          .on('error', async error => {
            // Try to unlink thumbnail,
            // since ffmpeg may have created an incomplete thumbnail
            try {
              await paths.unlink(thumbname)
            } catch (err) {
              if (err && err.code !== 'ENOENT')
                logger.error(`[${name}]: ${err.toString()}`)
            }
            return reject(error)
          })
          .on('end', () => resolve(true))
          .run()
      })
    } else {
      return false
    }
  } catch (error) {
    // Suppress error logging for errors these patterns
    const errorString = error.toString()
    const suppress = [
      /Input file contains unsupported image format/,
      /Invalid data found when processing input/,
      /File does not contain any video stream/
    ]

    if (!suppress.some(t => t.test(errorString)))
      logger.error(`[${name}]: ${errorString}`)

    try {
      await paths.symlink(paths.thumbPlaceholder, thumbname)
      return true
    } catch (err) {
      logger.error(err)
      return false
    }
  }

  return true
}

self.unlinkFile = async (filename, predb) => {
  try {
    await paths.unlink(path.join(paths.uploads, filename))
  } catch (error) {
    // Return true if file does not exist
    if (error.code !== 'ENOENT')
      throw error
  }

  const identifier = filename.split('.')[0]

  // Do not remove from identifiers cache on pre-db-deletion
  // eslint-disable-next-line curly
  if (!predb && self.idSet) {
    self.idSet.delete(identifier)
    // logger.log(`Removed ${identifier} from identifiers cache (deleteFile)`)
  }

  const extname = self.extname(filename)
  if (self.imageExts.includes(extname) || self.videoExts.includes(extname))
    try {
      await paths.unlink(path.join(paths.thumbs, `${identifier}.png`))
    } catch (error) {
      if (error.code !== 'ENOENT')
        throw error
    }
}

self.bulkDeleteFromDb = async (field, values, user) => {
  if (!user || !['id', 'name'].includes(field)) return

  // SQLITE_LIMIT_VARIABLE_NUMBER, which defaults to 999
  // Read more: https://www.sqlite.org/limits.html
  const MAX_VARIABLES_CHUNK_SIZE = 999
  const chunks = []
  while (values.length)
    chunks.push(values.splice(0, MAX_VARIABLES_CHUNK_SIZE))

  let failed = []
  const ismoderator = perms.is(user, 'moderator')

  try {
    let unlinkeds = []
    const albumids = []

    for (let i = 0; i < chunks.length; i++) {
      const files = await db.table('files')
        .whereIn(field, chunks[i])
        .where(function () {
          if (!ismoderator)
            self.where('userid', user.id)
        })

      // Push files that could not be found in db
      failed = failed.concat(chunks[i].filter(value => !files.find(file => file[field] === value)))

      // Unlink all found files
      const unlinked = []
      for (const file of files)
        try {
          await self.unlinkFile(file.name, true)
          unlinked.push(file)
        } catch (error) {
          logger.error(error)
          failed.push(file[field])
        }

      if (!unlinked.length)
        continue

      // Delete all unlinked files from db
      await db.table('files')
        .whereIn('id', unlinked.map(file => file.id))
        .del()
      self.invalidateStatsCache('uploads')

      if (self.idSet)
        unlinked.forEach(file => {
          const identifier = file.name.split('.')[0]
          self.idSet.delete(identifier)
          // logger.log(`Removed ${identifier} from identifiers cache (bulkDeleteFromDb)`)
        })

      // Push album ids
      unlinked.forEach(file => {
        if (file.albumid && !albumids.includes(file.albumid))
          albumids.push(file.albumid)
      })

      // Push unlinked files
      unlinkeds = unlinkeds.concat(unlinked)
    }

    if (unlinkeds.length) {
      // Update albums if necessary, but do not wait
      if (albumids.length)
        db.table('albums')
          .whereIn('id', albumids)
          .update('editedAt', Math.floor(Date.now() / 1000))
          .catch(logger.error)

      // Purge Cloudflare's cache if necessary, but do not wait
      if (config.cloudflare.purgeCache)
        self.purgeCloudflareCache(unlinkeds.map(file => file.name), true, true)
          .then(results => {
            for (const result of results)
              if (result.errors.length)
                result.errors.forEach(error => logger.error(`[CF]: ${error}`))
          })
    }
  } catch (error) {
    logger.error(error)
  }

  return failed
}

self.purgeCloudflareCache = async (names, uploads, thumbs) => {
  if (!Array.isArray(names) || !names.length || !cloudflareAuth)
    return [{
      success: false,
      files: [],
      errors: ['An unexpected error occured.']
    }]

  let domain = config.domain
  if (!uploads) domain = config.homeDomain

  const thumbNames = []
  names = names.map(name => {
    if (uploads) {
      const url = `${domain}/${name}`
      const extname = self.extname(name)
      if (thumbs && self.mayGenerateThumb(extname))
        thumbNames.push(`${domain}/thumbs/${name.slice(0, -extname.length)}.png`)
      return url
    } else {
      return name === 'home' ? domain : `${domain}/${name}`
    }
  })
  names = names.concat(thumbNames)

  // Split array into multiple arrays with max length of 30 URLs
  // https://api.cloudflare.com/#zone-purge-files-by-url
  const MAX_LENGTH = 30
  const chunks = []
  while (names.length)
    chunks.push(names.splice(0, MAX_LENGTH))

  const url = `https://api.cloudflare.com/client/v4/zones/${config.cloudflare.zoneId}/purge_cache`
  const results = []

  for (const chunk of chunks) {
    const result = {
      success: false,
      files: chunk,
      errors: []
    }

    try {
      const purge = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ files: chunk }),
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Email': config.cloudflare.email,
          'X-Auth-Key': config.cloudflare.apiKey
        }
      })
      const response = await purge.json()
      result.success = response.success
      if (Array.isArray(response.errors) && response.errors.length)
        result.errors = response.errors.map(error => `${error.code}: ${error.message}`)
    } catch (error) {
      result.errors = [error.toString()]
    }

    results.push(result)
  }

  return results
}

self.bulkDeleteExpired = async (dryrun) => {
  const timestamp = Date.now() / 1000
  const field = 'id'
  const sudo = { username: 'root' }

  const result = {}
  result.expired = await db.table('files')
    .where('expirydate', '<=', timestamp)
    .select(field)
    .then(rows => rows.map(row => row[field]))

  if (!dryrun) {
    const values = result.expired.slice() // Make a shallow copy
    result.failed = await self.bulkDeleteFromDb(field, values, sudo)
  }

  return result
}

self.invalidateStatsCache = type => {
  if (!['albums', 'users', 'uploads'].includes(type)) return
  statsCache[type].invalidatedAt = Date.now()
}

self.stats = async (req, res, next) => {
  const user = await self.authorize(req, res)
  if (!user) return

  const isadmin = perms.is(user, 'admin')
  if (!isadmin) return res.status(403).end()

  const stats = {}

  // Re-use caches as long as they are still valid

  if (!statsCache.system.cache && statsCache.system.generating) {
    stats.system = false
  } else if (statsCache.system.generating) {
    stats.system = statsCache.system.cache
  } else {
    statsCache.system.generating = true

    const os = await si.osInfo()
    const currentLoad = await si.currentLoad()
    const mem = await si.mem()

    stats.system = {
      platform: `${os.platform} ${os.arch}`,
      distro: `${os.distro} ${os.release}`,
      kernel: os.kernel,
      cpuLoad: `${currentLoad.currentload.toFixed(1)}%`,
      cpusLoad: currentLoad.cpus.map(cpu => `${cpu.load.toFixed(1)}%`).join(', '),
      systemMemory: {
        used: mem.active,
        total: mem.total
      },
      memoryUsage: process.memoryUsage().rss,
      nodeVersion: `${process.versions.node}`
    }

    // Update cache
    statsCache.system.cache = stats.system
    statsCache.system.generating = false
  }

  if (!statsCache.albums.cache && statsCache.albums.generating) {
    stats.albums = false
  } else if ((statsCache.albums.invalidatedAt < statsCache.albums.generatedAt) || statsCache.albums.generating) {
    stats.albums = statsCache.albums.cache
  } else {
    statsCache.albums.generating = true
    stats.albums = {
      total: 0,
      active: 0,
      downloadable: 0,
      public: 0,
      zips: 0
    }

    const albums = await db.table('albums')
    stats.albums.total = albums.length
    const identifiers = []
    for (const album of albums)
      if (album.enabled) {
        stats.albums.active++
        if (album.download) stats.albums.downloadable++
        if (album.public) stats.albums.public++
        if (album.zipGeneratedAt) identifiers.push(album.identifier)
      }

    const zipsDir = path.join(paths.uploads, 'zips')
    await Promise.all(identifiers.map(identifier => {
      return new Promise(resolve => {
        const filePath = path.join(zipsDir, `${identifier}.zip`)
        fs.access(filePath, error => {
          if (!error) stats.albums.zips++
          resolve(true)
        })
      })
    }))

    // Update cache
    statsCache.albums.cache = stats.albums
    statsCache.albums.generatedAt = Date.now()
    statsCache.albums.generating = false
  }

  if (!statsCache.users.cache && statsCache.users.generating) {
    stats.users = false
  } else if ((statsCache.users.invalidatedAt < statsCache.users.generatedAt) || statsCache.users.generating) {
    stats.users = statsCache.users.cache
  } else {
    statsCache.users.generating = true
    stats.users = {
      total: 0,
      disabled: 0
    }

    const permissionKeys = Object.keys(perms.permissions)
    permissionKeys.forEach(p => {
      stats.users[p] = 0
    })

    const users = await db.table('users')
    stats.users.total = users.length
    for (const user of users) {
      if (user.enabled === false || user.enabled === 0)
        stats.users.disabled++

      // This may be inaccurate on installations with customized permissions
      user.permission = user.permission || 0
      for (const p of permissionKeys)
        if (user.permission === perms.permissions[p]) {
          stats.users[p]++
          break
        }
    }

    // Update cache
    statsCache.users.cache = stats.users
    statsCache.users.generatedAt = Date.now()
    statsCache.users.generating = false
  }

  if (!statsCache.uploads.cache && statsCache.uploads.generating) {
    stats.uploads = false
  } else if ((statsCache.uploads.invalidatedAt < statsCache.uploads.generatedAt) || statsCache.uploads.generating) {
    stats.uploads = statsCache.uploads.cache
  } else {
    statsCache.uploads.generating = true
    stats.uploads = {
      total: 0,
      size: 0,
      images: 0,
      videos: 0,
      others: 0
    }

    const uploads = await db.table('files')
    stats.uploads.total = uploads.length
    for (const upload of uploads) {
      stats.uploads.size += parseInt(upload.size)
      const extname = self.extname(upload.name)
      if (self.imageExts.includes(extname))
        stats.uploads.images++
      else if (self.videoExts.includes(extname))
        stats.uploads.videos++
      else
        stats.uploads.others++
    }

    // Update cache
    statsCache.uploads.cache = stats.uploads
    statsCache.uploads.generatedAt = Date.now()
    statsCache.uploads.generating = false
  }

  return res.json({ success: true, stats })
}

module.exports = self
