<template>
  <div>
    <portal v-if="canRenderToolbarPortal" to="toolbar">Server Info and Settings</portal>
    <section-card>
      <v-card-text>Here you can edit your server's basic information.</v-card-text>
    </section-card>
    <div class="my-5"></div>
    <section-card>
      <v-card-text>
        <div
          v-for="(value, name) in serverDetails"
          :key="name"
          class="d-flex align-center mb-2"
        >
          <div class="flex-grow-1">
            <div v-if="value.type == 'boolean'">
              <p class="mt-2">{{ value.label }}</p>
              <v-switch
                v-model="serverModifications[name]"
                inset
                persistent-hint
                class="pa-1 ma-1 caption"
              >
                <template #label>
                  <span class="caption">{{ value.hint }}</span>
                </template>
              </v-switch>
            </div>
            <v-text-field
              v-else
              v-model="serverModifications[name]"
              persistent-hint
              :hint="value.hint"
              class="ma-0 body-2"
            ></v-text-field>
          </div>
        </div>
        <p class="mt-2">{{ defaultGlobals.label }}</p>
        <div class="flex-grow-1">
          <v-textarea
            v-model="defaultGlobalsString"
            persistent-hint
            :hint="defaultGlobals.hint"
            :rules="rules.checkGlobals()"
            class="ma-0 body-2"
            rows="2"
          ></v-textarea>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn block color="primary" :loading="loading" @click="saveEdit">Save</v-btn>
      </v-card-actions>
    </section-card>
  </div>
</template>

<script>
import gql from 'graphql-tag'
import { MainServerInfoQuery } from '@/graphql/server'
import pick from 'lodash/pick'
import {
  STANDARD_PORTAL_KEYS,
  buildPortalStateMixin
} from '@/main/utils/portalStateManager'

export default {
  name: 'ServerInfoAdminCard',
  components: {
    SectionCard: () => import('@/main/components/common/SectionCard')
  },
  mixins: [buildPortalStateMixin([STANDARD_PORTAL_KEYS.Toolbar], 'admin-settings', 1)],
  data() {
    return {
      edit: false,
      loading: false,
      serverModifications: {},
      serverDetails: {
        name: {
          label: 'Name',
          hint: "This server's public name"
        },
        description: {
          label: 'Description',
          hint: 'A short description of this server'
        },
        company: {
          label: 'Company',
          hint: 'The owner of this server'
        },
        adminContact: {
          label: 'Admin contact',
          hint: 'The administrator of this server'
        },
        termsOfService: {
          label: 'Terms of service',
          hint: 'Url pointing to the terms of service page'
        },
        inviteOnly: {
          label: 'Invite-only mode',
          hint: 'Only users with an invitation will be able to join',
          type: 'boolean'
        },
        loggedInUsersOnly: {
          label: 'Require log-in to access streams on this server',
          hint: 'Only logged-in users will be able to access streams - applies to both public and private streams',
          type: 'boolean'
        },
        enableGlobalReviewerAccess: {
          label:
            'Enable reviewer access to all streams on this server for any server user',
          hint: 'Give all server users reviewer (read only) access to all streams (both public and private) on this server',
          type: 'boolean'
        },
        requireJobNumberToCreateStreams: {
          label: 'Require job numbers for stream creation',
          hint: 'Users must provide a valid job number to create a stream (at time of stream creation)',
          type: 'boolean'
        },
        requireJobNumberToCreateCommits: {
          label: 'Require job numbers for commit creation (ie. for sending to streams)',
          hint: 'Users can create a stream commit only for streams that contain a job number',
          type: 'boolean'
        },
        createDefaultGlobals: {
          label: 'Add default globals on stream creation',
          hint: 'Automatically add the specified set of globals to all streams created on this server',
          type: 'boolean'
        }
      },
      defaultGlobals: {
        label: 'Default globals',
        hint: 'A json string containing a set of default globals and their default values, to be added to all streams on this server on stream creation'
      },
      rules: {
        checkGlobals() {
          return [
            (v) => {
              try {
                JSON.parse(v)
              } catch (e) {
                return 'Invalid JSON string'
              }
              return true
            }
          ]
        }
      },
      errors: []
    }
  },
  apollo: {
    serverInfo: {
      query: MainServerInfoQuery,
      update(data) {
        delete data.serverInfo.__typename
        this.serverModifications = Object.assign({}, data.serverInfo)
        return data.serverInfo
      }
    }
  },
  computed: {
    defaultGlobalsString: {
      set(value) {
        this.serverModifications.defaultGlobals = JSON.parse(value)
      },
      get() {
        return JSON.stringify(this.serverModifications.defaultGlobals)
      }
    }
  },
  methods: {
    async saveEdit() {
      this.loading = true
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($info: ServerInfoUpdateInput!) {
            serverInfoUpdate(info: $info)
          }
        `,
        variables: {
          info: pick(this.serverModifications, Object.keys(this.serverDetails))
        }
      })
      await this.$apollo.queries['serverInfo'].refetch()
      this.loading = false
    }
  }
}
</script>
