'use strict'
const {
  ApolloError,
  ForbiddenError,
  UserInputError,
  withFilter
} = require('apollo-server-express')

const {
  createStream,
  getStream,
  getStreams,
  updateStream,
  deleteStream,
  getUserStreams,
  getUserStreamsCount,
  getStreamUsers,
  grantPermissionsStream,
  revokePermissionsStream,
  favoriteStream,
  getFavoriteStreamsCollection,
  getActiveUserStreamFavoriteDate,
  getStreamFavoritesCount,
  getOwnedFavoritesCount
} = require('@/modules/core/services/streams')

const {
  authorizeResolver,
  validateScopes,
  validateServerRole,
  pubsub
} = require(`@/modules/shared`)
const { saveActivity } = require(`@/modules/activitystream/services`)
const {
  respectsLimits,
  respectsLimitsByProject,
  sendProjectInfoToValueTrack
} = require('@/modules/core/services/ratelimits')

const { getServerInfo } = require('../../services/generic')

// subscription events
const USER_STREAM_ADDED = 'USER_STREAM_ADDED'
const USER_STREAM_REMOVED = 'USER_STREAM_REMOVED'
const STREAM_UPDATED = 'STREAM_UPDATED'
const STREAM_DELETED = 'STREAM_DELETED'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const _deleteStream = async (parent, args, context) => {
  await saveActivity({
    streamId: args.id,
    resourceType: 'stream',
    resourceId: args.id,
    actionType: 'stream_delete',
    userId: context.userId,
    info: {},
    message: 'Stream deleted'
  })

  // Notify any listeners on the streamId
  await pubsub.publish(STREAM_DELETED, {
    streamDeleted: { streamId: args.id },
    streamId: args.id
  })

  // Notify all stream users
  const users = await getStreamUsers({ streamId: args.id })

  for (const user of users) {
    await pubsub.publish(USER_STREAM_REMOVED, {
      userStreamRemoved: { id: args.id },
      ownerId: user.id
    })
  }

  // delay deletion by a bit so we can do auth checks
  await sleep(250)

  // Delete after event so we can do authz
  await deleteStream({ streamId: args.id })
  return true
}

module.exports = {
  Query: {
    async stream(parent, args, context) {
      const stream = await getStream({ streamId: args.id, userId: context.userId })
      if (!stream) throw new ApolloError('Stream not found')

      if (!stream.isPublic && context.auth === false)
        throw new ForbiddenError('You are not authorized.')

      const info = await getServerInfo()
      const loggedInUsersOnly = info.loggedInUsersOnly
      if (loggedInUsersOnly || !stream.isPublic)
        await validateServerRole(context, 'server:user')

      if (!stream.isPublic) {
        await validateScopes(context.scopes, 'streams:read')

        const enableGlobalReviewerAccess = info.enableGlobalReviewerAccess
        if (!enableGlobalReviewerAccess)
          await authorizeResolver(context.userId, args.id, 'stream:reviewer')
      }

      return stream
    },

    async streams(parent, args, context) {
      if (args.limit && args.limit > 50)
        throw new UserInputError('Cannot return more than 50 items at a time.')

      const totalCount = await getUserStreamsCount({
        userId: context.userId,
        publicOnly: false,
        searchQuery: args.query
      })

      const { cursor, streams } = await getUserStreams({
        userId: context.userId,
        limit: args.limit,
        cursor: args.cursor,
        publicOnly: false,
        searchQuery: args.query
      })
      return { totalCount, cursor, items: streams }
    },

    async adminStreams(parent, args) {
      if (args.limit && args.limit > 50)
        throw new UserInputError('Cannot return more than 50 items at a time.')

      const { streams, totalCount } = await getStreams({
        offset: args.offset,
        limit: args.limit,
        orderBy: args.orderBy,
        publicOnly: args.publicOnly,
        searchQuery: args.query,
        visibility: args.visibility
      })
      return { totalCount, items: streams }
    }
  },

  Stream: {
    async collaborators(parent) {
      const users = await getStreamUsers({ streamId: parent.id })
      return users
    },

    async favoritedDate(parent, _args, ctx) {
      const { id: streamId } = parent
      return await getActiveUserStreamFavoriteDate({ ctx, streamId })
    },

    async favoritesCount(parent, _args, ctx) {
      const { id: streamId } = parent

      return await getStreamFavoritesCount({ ctx, streamId })
    }
  },

  User: {
    async streams(parent, args, context) {
      if (args.limit && args.limit > 50)
        throw new UserInputError('Cannot return more than 50 items.')
      // Return only the user's public streams if parent.id !== context.userId
      const publicOnly = parent.id !== context.userId
      const totalCount = await getUserStreamsCount({ userId: parent.id, publicOnly })

      const { cursor, streams } = await getUserStreams({
        userId: parent.id,
        limit: args.limit,
        cursor: args.cursor,
        publicOnly
      })

      return { totalCount, cursor, items: streams }
    },

    async favoriteStreams(parent, args, context) {
      const { userId } = context
      const { id: requestedUserId } = parent || {}
      const { limit, cursor } = args

      if (userId !== requestedUserId)
        throw new UserInputError("Cannot view another user's favorite streams")

      return await getFavoriteStreamsCollection({ userId, limit, cursor })
    },

    async totalOwnedStreamsFavorites(parent, _args, ctx) {
      const { id: userId } = parent

      return await getOwnedFavoritesCount({ ctx, userId })
    }
  },

  Mutation: {
    async streamCreate(parent, args, context) {
      const requireJobNumber = process.env.ENFORCE_JOB_NUMBER_REQUIREMENT === 'true'
      if (requireJobNumber) {
        if (!args.stream.jobNumber) {
          throw new Error(
            'A job number is required to create a stream. Please provide one.'
          )
        }
      }

      const rateLimitByProject = process.env.RATE_LIMIT_BY_PROJECT === 'true'
      if (!rateLimitByProject) {
        if (
          !(await respectsLimits({
            action: 'STREAM_CREATE',
            source: context.userId
          }))
        ) {
          throw new Error('Blocked due to rate-limiting. Try again later')
        }
      } else {
        const respectsLimits = await respectsLimitsByProject({
          action: 'STREAM_CREATE',
          source: args.stream.jobNumber
        })
        if (!respectsLimits) {
          throw new Error(
            'Blocked due to rate-limiting (on a per project basis). Please get in touch with your PM regarding use of Speckle on your project.'
          )
        }
      }

      const useValueTrack = process.env.USE_VALUETRACK === 'true'
      if (useValueTrack) {
        await sendProjectInfoToValueTrack({
          action: 'CREATE_ACTION_VALUETRACK',
          source: args.stream.jobNumber,
          userId: context.userId
        })
      }

      const id = await createStream({ ...args.stream, ownerId: context.userId })

      await saveActivity({
        streamId: id,
        resourceType: 'stream',
        resourceId: id,
        actionType: 'stream_create',
        userId: context.userId,
        info: { stream: args.stream },
        message: `Stream '${args.stream.name}' created`
      })
      await pubsub.publish(USER_STREAM_ADDED, {
        userStreamAdded: { id, ...args.stream },
        ownerId: context.userId
      })
      return id
    },

    async streamUpdate(parent, args, context) {
      await authorizeResolver(context.userId, args.stream.id, 'stream:owner')

      const oldValue = await getStream({ streamId: args.stream.id })
      const update = {
        streamId: args.stream.id,
        name: args.stream.name,
        description: args.stream.description,
        isPublic: args.stream.isPublic,
        allowPublicComments: args.stream.allowPublicComments,
        jobNumber: args.stream.jobNumber
      }

      await updateStream(update)

      await saveActivity({
        streamId: args.stream.id,
        resourceType: 'stream',
        resourceId: args.stream.id,
        actionType: 'stream_update',
        userId: context.userId,
        info: { old: oldValue, new: args.stream },
        message: 'Stream metadata changed'
      })
      await pubsub.publish(STREAM_UPDATED, {
        streamUpdated: {
          id: args.stream.id,
          name: args.stream.name,
          description: args.stream.description,
          jobNumber: args.stream.jobNumber
        },
        id: args.stream.id
      })

      return true
    },

    async streamDelete(parent, args, context, info) {
      await authorizeResolver(context.userId, args.id, 'stream:owner')
      return await _deleteStream(parent, args, context, info)
    },

    async streamsDelete(parent, args, context, info) {
      const results = await Promise.all(
        args.ids.map(async (id) => {
          const newArgs = { ...args }
          newArgs.id = id
          return await _deleteStream(parent, newArgs, context, info)
        })
      )
      return results.every((res) => res === true)
    },

    async streamGrantPermission(parent, args, context) {
      await authorizeResolver(
        context.userId,
        args.permissionParams.streamId,
        'stream:owner'
      )

      if (context.userId === args.permissionParams.userId)
        throw new Error('You cannot set roles for yourself.')

      const params = {
        streamId: args.permissionParams.streamId,
        userId: args.permissionParams.userId,
        role: args.permissionParams.role.toLowerCase() || 'read'
      }
      const granted = await grantPermissionsStream(params)

      if (granted) {
        await saveActivity({
          streamId: params.streamId,
          resourceType: 'stream',
          resourceId: params.streamId,
          actionType: 'stream_permissions_add',
          userId: context.userId,
          info: { targetUser: params.userId, role: params.role },
          message: `Permission granted to user ${params.userId} (${params.role})`
        })
        await pubsub.publish(USER_STREAM_ADDED, {
          userStreamAdded: {
            id: args.permissionParams.streamId,
            sharedBy: context.userId
          },
          ownerId: args.permissionParams.userId
        })
      }

      return granted
    },

    async streamRevokePermission(parent, args, context) {
      await authorizeResolver(
        context.userId,
        args.permissionParams.streamId,
        'stream:owner'
      )

      if (context.userId === args.permissionParams.userId)
        throw new ApolloError('You cannot revoke your own access rights to a stream.')

      const revoked = await revokePermissionsStream({ ...args.permissionParams })

      if (revoked) {
        await saveActivity({
          streamId: args.permissionParams.streamId,
          resourceType: 'stream',
          resourceId: args.permissionParams.streamId,
          actionType: 'stream_permissions_remove',
          userId: context.userId,
          info: { targetUser: args.permissionParams.userId },
          message: `Permission revoked for user ${args.permissionParams.userId}`
        })
        await pubsub.publish(USER_STREAM_REMOVED, {
          userStreamRemoved: {
            id: args.permissionParams.streamId,
            revokedBy: context.userId
          },
          ownerId: args.permissionParams.userId
        })
      }

      return revoked
    },

    async streamFavorite(_parent, args, ctx) {
      const { streamId, favorited } = args
      const { userId } = ctx

      return await favoriteStream({ userId, streamId, favorited })
    }
  },

  Subscription: {
    userStreamAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([USER_STREAM_ADDED]),
        (payload, variables, context) => {
          return payload.ownerId === context.userId
        }
      )
    },

    userStreamRemoved: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([USER_STREAM_REMOVED]),
        (payload, variables, context) => {
          return payload.ownerId === context.userId
        }
      )
    },

    streamUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([STREAM_UPDATED]),
        async (payload, variables, context) => {
          const info = await getServerInfo()
          const loggedInUsersOnly = info.loggedInUsersOnly
          if (loggedInUsersOnly) await validateServerRole(context, 'server:user')
          const enableGlobalReviewerAccess = info.enableGlobalReviewerAccess
          if (!enableGlobalReviewerAccess)
            await authorizeResolver(context.userId, payload.id, 'stream:reviewer')
          return payload.id === variables.streamId
        }
      )
    },

    streamDeleted: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([STREAM_DELETED]),
        async (payload, variables, context) => {
          const info = await getServerInfo()
          const loggedInUsersOnly = info.loggedInUsersOnly
          if (loggedInUsersOnly) await validateServerRole(context, 'server:user')
          const enableGlobalReviewerAccess = info.enableGlobalReviewerAccess
          if (!enableGlobalReviewerAccess)
            await authorizeResolver(context.userId, payload.streamId, 'stream:reviewer')
          return payload.streamId === variables.streamId
        }
      )
    }
  }
}
