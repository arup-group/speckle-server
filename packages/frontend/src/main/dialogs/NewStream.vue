<template>
  <v-card>
    <v-toolbar color="primary" dark flat>
      <v-app-bar-nav-icon style="pointer-events: none">
        <v-icon>mdi-plus-box</v-icon>
      </v-app-bar-nav-icon>
      <v-toolbar-title>Create a New Stream</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="$emit('close')"><v-icon>mdi-close</v-icon></v-btn>
    </v-toolbar>
    <v-form
      ref="form"
      v-model="valid"
      lazy-validation
      class="px-2"
      @submit.prevent="createStream"
    >
      <v-card-text>
        <job-number-search
          v-if="requireJobNumberToCreateStreams"
          ref="input-field"
          :job-number-required="requireJobNumberToCreateStreams"
          @jobObjectSelected="selectedJobNumber"
        ></job-number-search>
        <v-text-field
          v-model="name"
          :rules="nameRules"
          validate-on-blur
          label="Stream Name (optional)"
        />
        <v-textarea
          v-model="description"
          rows="1"
          row-height="15"
          label="Description (optional)"
        />
        <v-switch
          v-model="isPublic"
          v-tooltip="
            isPublic
              ? `Anyone with the link can view this stream. It is also visible on your profile page. Only collaborators
          can edit it.`
              : `Only collaborators can access this stream.`
          "
          inset
          :label="`${isPublic ? 'Link Sharing On' : 'Link Sharing Off'}`"
        />

        <p class="mt-5">
          <b>Add collaborators</b>
        </p>
        <v-text-field
          v-model="search"
          label="Search users..."
          placeholder="Search by name or by email"
        />
        <div v-if="$apollo.loading">Searching.</div>
        <v-list v-if="userSearch && userSearch.items" one-line>
          <v-list-item v-if="userSearch.items.length === 0">
            <v-list-item-content>
              <v-list-item-title>No users found.</v-list-item-title>
              <v-list-item-subtitle>Try a different search query.</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            v-for="item in userSearch.items"
            :key="item.id"
            @click="addCollab(item)"
          >
            <v-list-item-avatar>
              <user-avatar
                :id="item.id"
                :name="item.name"
                :avatar="item.avatar"
                :size="25"
                class="ml-1"
              ></user-avatar>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ item.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ item.company ? item.company : 'no company info' }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-icon>mdi-plus</v-icon>
            </v-list-item-action>
          </v-list-item>
        </v-list>
        <v-chip
          v-for="user in collabs"
          :key="user.id"
          close
          class="ma-2"
          @click:close="removeCollab(user)"
        >
          <user-avatar
            :id="user.id"
            :name="user.name"
            :avatar="user.avatar"
            :size="25"
            left
          ></user-avatar>
          <span class="caption">{{ user.name }}</span>
        </v-chip>
      </v-card-text>
      <v-card-actions class="pb-3">
        <v-btn
          color="primary"
          block
          large
          :disabled="!valid"
          :loading="isLoading"
          elevation="0"
          type="submit"
        >
          Create Stream
        </v-btn>
      </v-card-actions>
    </v-form>
  </v-card>
</template>
<script>
import gql from 'graphql-tag'
import userSearchQuery from '../../graphql/userSearch.gql'

export default {
  components: {
    UserAvatar: () => import('@/main/components/common/UserAvatar'),
    JobNumberSearch: () => import('@/main/components/common/JobNumberSearch')
  },
  props: {
    open: {
      type: Boolean,
      default: false
    },
    redirect: {
      type: Boolean,
      default: true
    }
  },
  apollo: {
    userSearch: {
      query: userSearchQuery,
      variables() {
        return {
          query: this.search,
          limit: 10
        }
      },
      skip() {
        return !this.search || this.search.length < 3
      },
      debounce: 300
    },
    requireJobNumberToCreateStreams: {
      query: gql`
        query {
          serverInfo {
            requireJobNumberToCreateStreams
          }
        }
      `,
      prefetch: true,
      update: (data) => data.serverInfo.requireJobNumberToCreateStreams
    }
  },
  data() {
    return {
      name: null,
      jobNumber: null,
      description: null,
      valid: false,
      search: null,
      junkJobNumbers: ['00000000', '12345678', '12345600', '99999999'],
      jobNumberRules: [
        (v) =>
          !v ||
          this.junkJobNumbers.findIndex((e) => e === v) === -1 ||
          `That doesn't look like a valid job number`,
        (v) => (!v || /^\d+$/.test(v) ? true : 'Job number must contain numbers only'),
        (v) => {
          if (v && v.length !== 8) return 'Job number must be 8 characters'
          return true
        }
      ],
      nameRules: [],
      isPublic: false,
      collabs: [],
      isLoading: false
    }
  },
  watch: {
    open() {
      this.name = null
      this.jobNumber = null
      this.search = null
      if (this.userSearch) this.userSearch.items = null
      this.collabs = []
    }
  },
  mounted() {
    this.nameRules = [
      (v) =>
        !v ||
        (v.length <= 150 && v.length >= 3) ||
        'Stream name must be between 3 and 150 characters.'
      // (v) => (!v && v.length <= 150) || 'Name must be less than 150 characters',
      // (v) => (!v && v.length >= 3) || 'Name must be at least 3 characters'
    ]
  },
  methods: {
    addCollab(user) {
      if (user.id === localStorage.getItem('uuid')) return
      const indx = this.collabs.findIndex((u) => u.id === user.id)
      if (indx !== -1) return
      user.role = 'stream:contributor'
      this.collabs.push(user)
      this.search = null
      this.userSearch.items = null
    },
    removeCollab(user) {
      const indx = this.collabs.findIndex((u) => u.id === user.id)
      this.collabs.splice(indx, 1)
    },
    async createStream() {
      if (!this.$refs.form.validate()) return

      this.isLoading = true
      this.$mixpanel.track('Stream Action', { type: 'action', name: 'create' })
      try {
        const res = await this.$apollo.mutate({
          mutation: gql`
            mutation streamCreate($myStream: StreamCreateInput!) {
              streamCreate(stream: $myStream)
            }
          `,
          variables: {
            myStream: {
              name: this.name,
              isPublic: this.isPublic,
              description: this.description,
              jobNumber: this.jobNumber
            }
          }
        })

        if (this.collabs.length !== 0) {
          for (const user of this.collabs) {
            await this.$apollo.mutate({
              mutation: gql`
                mutation grantPermission($params: StreamGrantPermissionInput!) {
                  streamGrantPermission(permissionParams: $params)
                }
              `,
              variables: {
                params: {
                  streamId: res.data.streamCreate,
                  userId: user.id,
                  role: 'stream:contributor'
                }
              }
            })
          }
        }
        this.$emit('created')
        if (this.redirect)
          this.$router.push({ path: `/streams/${res.data.streamCreate}` })
      } catch (e) {
        this.$eventHub.$emit('notification', {
          text: e.message
        })
      }
      this.isLoading = false
    },
    selectedJobNumber(event) {
      if (event) {
        this.jobNumber = event.JobCode
      }
    }
  }
}
</script>

<style lang="css">
.required .v-label {
  color: red;
  opacity: 0.7;
}
</style>
