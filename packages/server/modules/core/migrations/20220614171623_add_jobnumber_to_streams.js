/* istanbul ignore file */
exports.up = async (knex) => {
  await knex.schema.alterTable('streams', (table) => {
    table.string('jobNumber', 10)
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('streams', (table) => {
    table.dropColumn('jobNumber')
  })
}
