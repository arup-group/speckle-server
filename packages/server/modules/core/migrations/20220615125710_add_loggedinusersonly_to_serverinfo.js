/* istanbul ignore file */
exports.up = async (knex) => {
  await knex.schema.alterTable('server_config', (table) => {
    table.boolean('loggedInUsersOnly').defaultTo(false)
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('server_config', (table) => {
    table.dropColumn('loggedInUsersOnly')
  })
}
