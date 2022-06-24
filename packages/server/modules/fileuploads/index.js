/* istanbul ignore file */
'use strict'

const debug = require('debug')
const { contextMiddleware } = require('@/modules/shared')
const { saveUploadFile } = require('./services/fileuploads')
const request = require('request')
const {
  authMiddlewareCreator,
  streamWritePermissions
} = require('@/modules/shared/authz')

const saveFileUploads = async ({ userId, streamId, branchName, uploadResults }) => {
  await Promise.all(
    uploadResults.map(async (upload) => {
      await saveUploadFile({
        fileId: upload.blobId,
        streamId,
        branchName,
        userId,
        fileName: upload.fileName,
        fileType: upload.fileName.split('.').pop(),
        fileSize: upload.fileSize
      })
    })
  )
}
const { getServerInfo } = require('../core/services/generic')

exports.init = async (app) => {
  if (process.env.DISABLE_FILE_UPLOADS) {
    debug('speckle:modules')('📄 FileUploads module is DISABLED')
    return
  } else {
    debug('speckle:modules')('📄 Init FileUploads module')
  }

  if (!process.env.S3_BUCKET) {
    debug('speckle:modules')(
      'ERROR: S3_BUCKET env variable was not specified. File uploads will be DISABLED.'
    )
    return
  }

  await checkBucket()

  const checkStreamPermissions = async (req) => {
    if (!req.context || !req.context.auth) {
      return { hasPermissions: false, httpErrorCode: 401 }
    }

    try {
      await validateScopes(req.context.scopes, 'streams:write')
    } catch (err) {
      return { hasPermissions: false, httpErrorCode: 401 }
    }

    try {
      await authorizeResolver(
        req.context.userId,
        req.params.streamId,
        'stream:contributor'
      )
    } catch (err) {
      return { hasPermissions: false, httpErrorCode: 401 }
    }

    return { hasPermissions: true, httpErrorCode: 200 }
  }

  app.get('/api/file/:fileId', contextMiddleware, async (req, res) => {
    if (process.env.DISABLE_FILE_UPLOADS) {
      return res.status(503).send('File uploads are disabled on this server')
    }

    const fileInfo = await getFileInfo({ fileId: req.params.fileId })

    if (!fileInfo) return res.status(404).send('File not found')

    // Check stream read access
    const streamId = fileInfo.streamId
    const stream = await getStream({ streamId, userId: req.context.userId })

    if (!stream) {
      return res.status(404).send('File stream not found')
    }

    if (!stream.isPublic && req.context.auth === false) {
      return res.status(401).send('You must be logged in to access private streams')
    }

    if (!stream.isPublic) {
      try {
        await validateScopes(req.context.scopes, 'streams:read')
      } catch (err) {
        return res.status(401).send("The provided auth token can't read streams")
      }

      try {
        const info = await getServerInfo()
        const enableGlobalReviewerAccess = info.enableGlobalReviewerAccess
        if (!enableGlobalReviewerAccess)
          await authorizeResolver(req.context.userId, streamId, 'stream:reviewer')
      } catch (err) {
        return res.status(401).send("You don't have access to this private stream")
      }
    }

    const fileStream = await getFileStream({ fileId: req.params.fileId })

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileInfo.fileName}"`
    })

    fileStream.pipe(res)
  }),
    app.post(
      '/api/file/:fileType/:streamId/:branchName?',
      contextMiddleware,
      authMiddlewareCreator(streamWritePermissions),
      async (req, res) => {
        req.pipe(
          request(
            `${process.env.CANONICAL_URL}/api/stream/${req.params.streamId}/blob`,
            async (err, response, body) => {
              if (response.statusCode === 201) {
                const { uploadResults } = JSON.parse(body)
                await saveFileUploads({
                  userId: req.context.userId,
                  streamId: req.params.streamId,
                  branchName: req.params.branchName ?? 'main',
                  uploadResults
                })
              }
              res.status(response.statusCode).send(body)
            }
          )
        )
      }
    )
}

exports.finalize = () => {}
