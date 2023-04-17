'use strict'
const {
  validateServerRole,
  validateScopes,
  authorizeResolver
} = require('@/modules/shared')

const {
  createObjects,
  getObject,
  getObjectChildren,
  getObjectChildrenQuery
} = require('../../services/objects')

const { getBranchesByStreamId } = require('../../services/branches')

const { getCommitsByBranchName } = require('../../services/commits')

const omitDeep = require('omit-deep-lodash')

module.exports = {
  Stream: {
    async object(parent, args) {
      const obj = await getObject({ streamId: parent.id, objectId: args.id })
      if (!obj) return null

      obj.streamId = parent.id
      return obj
    },
    async globals(parent) {
      const branches = await getBranchesByStreamId({ streamId: parent.id })
      if (!branches || !branches.items.some((b) => b.name === 'globals')) return null

      const { commits } = await getCommitsByBranchName({
        streamId: parent.id,
        branchName: 'globals',
        limit: 1
      })
      if (!commits || commits.length === 0) return null

      const refObj = commits[0].referencedObject
      const obj = await getObject({ streamId: parent.id, objectId: refObj })
      if (!obj) return null

      const items = omitDeep(obj.data, ['totalChildrenCount', 'speckle_type', 'id'])
      const totalCount = Object.keys(items).length

      return { totalCount, items }
    }
  },
  Object: {
    async children(parent, args) {
      // The simple query branch
      if (!args.query && !args.orderBy) {
        const result = await getObjectChildren({
          streamId: parent.streamId,
          objectId: parent.id,
          limit: args.limit,
          depth: args.depth,
          select: args.select,
          cursor: args.cursor
        })
        result.objects.forEach((x) => (x.streamId = parent.streamId))
        return {
          totalCount: parent.totalChildrenCount,
          cursor: result.cursor,
          objects: result.objects
        }
      }

      // The complex query branch
      const result = await getObjectChildrenQuery({
        streamId: parent.streamId,
        objectId: parent.id,
        limit: args.limit,
        depth: args.depth,
        select: args.select,
        query: args.query,
        orderBy: args.orderBy,
        cursor: args.cursor
      })
      result.objects.forEach((x) => (x.streamId = parent.streamId))
      return result
    }
  },
  Mutation: {
    async objectCreate(parent, args, context) {
      await validateServerRole(context, 'server:user')
      await validateScopes(context.scopes, 'streams:write')
      await authorizeResolver(
        context.userId,
        args.objectInput.streamId,
        'stream:contributor'
      )

      const ids = await createObjects(
        args.objectInput.streamId,
        args.objectInput.objects
      )
      return ids
    }
  }
}
