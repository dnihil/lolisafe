const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const swaggerJsdoc = require('swagger-jsdoc')

const self = {
  dest: './public/openapi.json',
  options: {
    failOnErrors: true,
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'lolisafe',
        version: '3.0.0'
      }
    },
    apis: ['./routes/*.js']
  },
  // This is a parallel of utilsController.js->stripIndents().
  // Added here so that this script won't have to import the said controller.
  stripIndents: string => {
    if (!string) return
    const result = string.replace(/^[^\S\n]+/gm, '')
    const match = result.match(/^[^\S\n]*(?=\S)/gm)
    const indent = match && Math.min(...match.map(el => el.length))
    if (indent) {
      const regexp = new RegExp(`^.{${indent}}`, 'gm')
      return result.replace(regexp, '')
    }
    return result
  },
  access: promisify(fs.access),
  writeFile: promisify(fs.writeFile)
}

;(async () => {
  const openapiSpecification = swaggerJsdoc(self.options)

  // logger.inspect(openapiSpecification)

  const file = path.resolve(self.dest)

  // Stringify OpenAPI specification
  const stringified = JSON.stringify(openapiSpecification, null, 2) + '\n'

  // Write to file
  await self.writeFile(file, stringified)
  // console.log(`Successfully written OpenAPI specification to ${self.dest}.`)
})()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
