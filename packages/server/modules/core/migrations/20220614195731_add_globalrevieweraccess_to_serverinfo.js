/* istanbul ignore file */
exports.up = async (knex) => {
  await knex.schema.alterTable('server_config', (table) => {
    table.boolean('enableGlobalReviewerAccess').defaultTo(false)
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('server_config', (table) => {
    table.dropColumn('enableGlobalReviewerAccess')
  })
}