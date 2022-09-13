const { Router } = require('hyper-express')
const routes = new Router()
const albums = require('./../controllers/albumsController')
const auth = require('./../controllers/authController')
const tokens = require('./../controllers/tokenController')
const upload = require('./../controllers/uploadController')
const utils = require('./../controllers/utilsController')
const config = require('./../config')

/**
 * @openapi
 * components:
 *   schemas:
 *     Username:
 *       type: string
 *       minLength: 4
 *       maxLength: 32
 *     Password:
 *       type: string
 *       format: password
 *       minLength: 6
 *       maxLength: 64
 *     Result:
 *       type: object
 *       required:
 *         - success
 *       properties:
 *         success:
 *           type: boolean
 *     Error:
 *       type: object
 *       required:
 *         - success
 *         - description
 *       properties:
 *         success:
 *           type: boolean
 *         description:
 *           type: string
 *         code:
 *           description: Helper error code. Currently very sparsely used.
 *           type: number
 *   responses:
 *     Success:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Result"
 *           example:
 *             success: true
 *     BadRequest:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Error"
 *           example:
 *             success: false
 *             description: Bad request.
 *     Unauthorized:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Error"
 *           example:
 *             success: false
 *             description: Invalid token.
 *             code: 10001
 *     ServerError:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Error"
 *           example:
 *             success: false
 *             description: An unexpected error occurred. Try again?
 *   securitySchemes:
 *     token:
 *       type: apiKey
 *       name: token
 *       in: header
 * tags:
 *   - name: General
 *     description: General routes
 *   - name: Uploads
 *     description: Uploads routes
 *   - name: Auth
 *     description: Auth routes
 *   - name: Users
 *     description: Users routes
 *   - name: Album
 *     description: Albums routes
 *   - name: Moderation
 *     description: Moderation routes
 *   - name: Administration
 *     description: Administration routes
 */

/**
 * @openapi
 * /api/check:
 *   get:
 *     summary: Get server's partial config
 *     description: This only contains the necessary config to customize the homepage uploader's behavior.
 *     tags:
 *       - General
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - private
 *                 - enableUserAccounts
 *                 - maxSize
 *                 - chunkSize
 *                 - fileIdentifierLength
 *                 - stripTags
 *               properties:
 *                 private:
 *                   type: boolean
 *                 enableUserAccounts:
 *                   type: boolean
 *                 maxSize:
 *                   type: string
 *                 chunkSize:
 *                   type: object
 *                 fileIdentifierLength:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 *                     default:
 *                       type: number
 *                     force:
 *                       type: boolean
 *                 stripTags:
 *                   oneOf:
 *                     - type: object
 *                     - type: boolean
 *                 temporaryUploadAges:
 *                   type: array
 *                   items:
 *                     type: number
 *                 defaultTemporaryUploadAge:
 *                   type: number
 *                 version:
 *                   type: string
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
routes.get('/check', async (req, res) => {
  const obj = {
    private: config.private,
    enableUserAccounts: config.enableUserAccounts,
    maxSize: config.uploads.maxSize,
    chunkSize: config.uploads.chunkSize,
    fileIdentifierLength: config.uploads.fileIdentifierLength,
    stripTags: config.uploads.stripTags
  }
  if (utils.retentions.enabled && utils.retentions.periods._) {
    obj.temporaryUploadAges = utils.retentions.periods._
    obj.defaultTemporaryUploadAge = utils.retentions.default._
  }
  if (utils.clientVersion) {
    obj.version = utils.clientVersion
  }
  return res.json(obj)
})

/** ./controllers/authController.js */
/**
 * @openapi
 * components:
 *   schemas:
 *     UsernamePassword:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           $ref: "#/components/schemas/Username"
 *         password:
 *           $ref: "#/components/schemas/Password"
 *   responses:
 *     AuthSuccessful:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - success
 *               - token
 *             properties:
 *               success:
 *                 type: boolean
 *               token:
 *                 description: Token that can be used for user authentication in other API routes.
 *                 type: string
 *           example:
 *             success: true
 *             token: YOUR_TOKEN_HERE
 */

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Verify user credentials and get token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UsernamePassword"
 *           example:
 *             username: ""
 *             password: ""
 *     responses:
 *       200:
 *         $ref: "#/components/responses/AuthSuccessful"
 *       400:
 *         $ref: "#/components/responses/BadRequest"
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *             example:
 *               success: false
 *               description: Wrong credentials.
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
routes.post('/login', utils.assertJSON, auth.verify)

/**
 * @openapi
 * /api/register:
 *   post:
 *     summary: Register a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UsernamePassword"
 *           example:
 *             username: ""
 *             password: ""
 *     responses:
 *       200:
 *         $ref: "#/components/responses/AuthSuccessful"
 *       400:
 *         $ref: "#/components/responses/BadRequest"
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *             example:
 *               success: false
 *               description: Registration is currently disabled.
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
routes.post('/register', utils.assertJSON, auth.register)

/**
 * @openapi
 * /api/password/change:
 *   post:
 *     summary: Change user's password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 $ref: "#/components/schemas/Password"
 *           example:
 *             password: ""
 *     responses:
 *       200:
 *         $ref: "#/components/responses/Success"
 *       400:
 *         $ref: "#/components/responses/BadRequest"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.post('/password/change', [auth.requireUser, utils.assertJSON], auth.changePassword)

/**
 * @openapi
 * components:
 *   schemas:
 *     UserID:
 *       description: User's numerical ID in database.
 *       type: number
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - username
 *         - enabled
 *         - timestamp
 *         - registration
 *         - groups
 *         - uploads
 *         - usage
 *       properties:
 *         id:
 *           $ref: "#/components/schemas/UserID"
 *         username:
 *           $ref: "#/components/schemas/Username"
 *         enabled:
 *           description: Whether user is enabled or not.
 *           type: boolean
 *           nullable: true
 *         timestamp:
 *           description: Timestamp of user's last token update.
 *           type: number
 *           nullable: true
 *         registration:
 *           description: Timestamp of user's registration date.
 *           type: number
 *           nullable: true
 *         groups:
 *           description: Usergroup(s) information.
 *           type: object
 *         uploads:
 *           description: Amount of uploads associated to this user.
 *           type: number
 *         usage:
 *           description: Amount of disk used by this user in bytes.
 *           type: number
 *     Usergroup:
 *       description: Usergroup name.
 *       type: string
 *   responses:
 *     UsersResponse:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - success
 *               - users
 *               - usersPerPage
 *               - count
 *             properties:
 *               success:
 *                 type: boolean
 *               users:
 *                 description: Array of users.
 *                 type: array
 *                 items:
 *                   $ref: "#/components/schemas/User"
 *               usersPerPage:
 *                 description: Users per page for pagination.
 *                 type: number
 *               count:
 *                 description: Total users in database.
 *                 type: number
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get users at page 1
 *     description: Requires admin permission.
 *     tags:
 *       - Users
 *       - Administration
 *     responses:
 *       200:
 *         $ref: "#/components/responses/UsersResponse"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.get('/users', auth.requireUser, auth.listUsers)

/**
 * @openapi
 * /api/users/{page}:
 *   get:
 *     summary: Get users at page N
 *     description: Requires admin permission. This allows negative value to navigate backwards.
 *     tags:
 *       - Users
 *       - Administration
 *     parameters:
 *       - in: path
 *         name: page
 *         schema:
 *           type: number
 *         required: true
 *         description: Page of users to get.
 *     responses:
 *       200:
 *         $ref: "#/components/responses/UsersResponse"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.get('/users/:page', auth.requireUser, auth.listUsers)

/**
 * @openapi
 * /api/users/create:
 *   post:
 *     summary: Create a new user
 *     description: Requires admin permission. If password is omitted, server will generate a random one.
 *     tags:
 *       - Users
 *       - Administration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - group
 *             properties:
 *               username:
 *                 $ref: "#/components/schemas/Username"
 *               password:
 *                 $ref: "#/components/schemas/Password"
 *               group:
 *                 $ref: "#/components/schemas/Usergroup"
 *           example:
 *             username: ""
 *             password: ""
 *             group: user
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - username
 *                 - password
 *                 - group
 *               properties:
 *                 success:
 *                   type: boolean
 *                 username:
 *                   $ref: "#/components/schemas/Username"
 *                 password:
 *                   $ref: "#/components/schemas/Password"
 *                 group:
 *                   $ref: "#/components/schemas/Usergroup"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.post('/users/create', [auth.requireUser, utils.assertJSON], auth.createUser)

/**
 * @openapi
 * /api/users/delete:
 *   post:
 *     summary: Delete a user
 *     description: Requires admin permission.
 *     tags:
 *       - Users
 *       - Administration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 $ref: "#/components/schemas/UserID"
 *               purge:
 *                 description: Whether to purge the user's uploaded files as well.
 *                 type: boolean
 *           example:
 *             id: 69420
 *             purge: false
 *     responses:
 *       200:
 *         $ref: "#/components/responses/Success"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.post('/users/delete', [auth.requireUser, utils.assertJSON], auth.deleteUser)

/**
 * @openapi
 * /api/users/disable:
 *   post:
 *     summary: Disable a user
 *     description: Requires admin permission.
 *     tags:
 *       - Users
 *       - Administration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 $ref: "#/components/schemas/UserID"
 *           example:
 *             id: 69420
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - update
 *               properties:
 *                 success:
 *                   type: boolean
 *                 update:
 *                   type: object
 *                   required:
 *                     - enabled
 *                   properties:
 *                     enabled:
 *                       description: Whether user is enabled or not.
 *                       type: boolean
 *             example:
 *               success: true
 *               update:
 *                 enabled: false
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.post('/users/disable', [auth.requireUser, utils.assertJSON], auth.disableUser)

/**
 * @openapi
 * /api/users/edit:
 *   post:
 *     summary: Edit a user
 *     description: Requires admin permission.
 *     tags:
 *       - Users
 *       - Administration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 $ref: "#/components/schemas/UserID"
 *               username:
 *                 $ref: "#/components/schemas/Username"
 *               group:
 *                 $ref: "#/components/schemas/Usergroup"
 *               enabled:
 *                 description: Whether to enable or disable user.
 *                 type: boolean
 *               resetPassword:
 *                 description: Whether to reset user's password with a randomly generated one.
 *                 type: boolean
 *           example:
 *             id: 69420
 *             username: ""
 *             group: user
 *             enabled: true
 *             resetPassword: false
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - update
 *               properties:
 *                 success:
 *                   type: boolean
 *                 update:
 *                   type: object
 *                   properties:
 *                     username:
 *                       $ref: "#/components/schemas/Username"
 *                     enabled:
 *                       description: Whether user is enabled or not.
 *                       type: boolean
 *                     permission:
 *                       description: Numeric permission according to selected usergroup.
 *                       type: number
 *                     password:
 *                       $ref: "#/components/schemas/Password"
 *       403:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *     security:
 *       - token: []
 */
routes.post('/users/edit', [auth.requireUser, utils.assertJSON], auth.editUser)

/** ./controllers/uploadController.js */

// HyperExpress defaults to 250kb
// https://github.com/kartikk221/hyper-express/blob/6.4.4/docs/Server.md#server-constructor-options
const maxBodyLength = parseInt(config.uploads.maxSize) * 1e6
routes.post('/upload', { max_body_length: maxBodyLength }, auth.optionalUser, upload.upload)
routes.post('/upload/:albumid', { max_body_length: maxBodyLength }, auth.optionalUser, upload.upload)
routes.post('/upload/finishchunks', [auth.optionalUser, utils.assertJSON], upload.finishChunks)

routes.get('/uploads', auth.requireUser, upload.list)
routes.get('/uploads/:page', auth.requireUser, upload.list)
routes.get('/album/:albumid/:page', auth.requireUser, upload.list)

routes.get('/upload/get/:identifier', auth.requireUser, upload.get)
routes.post('/upload/delete', [auth.requireUser, utils.assertJSON], upload.delete)
routes.post('/upload/bulkdelete', [auth.requireUser, utils.assertJSON], upload.bulkDelete)

/** ./controllers/albumsController.js */

routes.get('/albums', auth.requireUser, albums.list)
routes.get('/albums/:page', auth.requireUser, albums.list)

routes.get('/album/get/:identifier', albums.get)
routes.get('/album/zip/:identifier', albums.generateZip)
routes.get('/album/:identifier', albums.getUpstreamCompat)

routes.post('/albums', [auth.requireUser, utils.assertJSON], albums.create)
routes.post('/albums/addfiles', [auth.requireUser, utils.assertJSON], albums.addFiles)
routes.post('/albums/delete', [auth.requireUser, utils.assertJSON], albums.delete)
routes.post('/albums/disable', [auth.requireUser, utils.assertJSON], albums.disable)
routes.post('/albums/edit', [auth.requireUser, utils.assertJSON], albums.edit)
routes.post('/albums/rename', [auth.requireUser, utils.assertJSON], albums.rename)

/** ./controllers/tokenController.js **/

routes.get('/tokens', auth.requireUser, tokens.list)
routes.post('/tokens/change', (req, res, next) => {
  // Include user's "token" field into database query
  auth.requireUser(req, res, next, 'token')
}, tokens.change)
routes.post('/tokens/verify', utils.assertJSON, tokens.verify)

/** ./controllers/utilsController.js */

routes.get('/stats', [auth.requireUser], utils.stats)

module.exports = routes
