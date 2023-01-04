<template>
  <v-container class="pa-0">
    <v-menu offset-y max-height="200px" allow-overflow>
      <template #activator="{ on, attrs }">
        <v-text-field
          v-bind="attrs"
          ref="input-field"
          v-model="jobNumber"
          :rules="[validateJobNumber]"
          :label="jobNumberLabel"
          @keyup="jobNumberChanged(jobNumber)"
          v-on="on"
        ></v-text-field>
      </template>
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="indigo"
      ></v-progress-linear>
      <div v-if="searchOptions && searchOptions.length > 0">
        <v-list class="overflow-y: auto">
          <v-list-item
            v-for="jobNumberInfo in searchOptions"
            :key="jobNumberInfo.JobCode"
            color="grey"
            @click="jobNumberSelected(jobNumberInfo)"
          >
            <v-list-item-title>
              {{ jobNumberInfo.JobCode.concat(' ', jobNumberInfo.JobNameLong) }}
            </v-list-item-title>
            <br />
          </v-list-item>
        </v-list>
      </div>
      <v-list v-else-if="searchError" class="overflow-y: auto">
        <v-list-item color="grey">
          <v-list-item-title>
            <span class="grey--text">
              This doesn't seem to be a valid job number or job name.
            </span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
      <v-list v-else class="overflow-y: auto">
        <v-list-item color="grey">
          <v-list-item-title>
            <span class="grey--text">
              Type in a job number (with no spaces or dashes) or job name to search
            </span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-container>
</template>

<script>
export default {
  name: 'JobNumberSearch',
  props: {
    initialJobNumber: {
      type: String,
      default: null
    },
    jobNumberRequired: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      jobNumberLabel: 'Search job numbers or names...',
      searchError: false,
      jobNumberAndName: null,
      jobNumber: null,
      jobName: null,
      projectInfo: null,
      searchOptions: null,
      loading: false
    }
  },
  created() {
    if (this.jobNumberRequired) {
      this.jobNumberLabel = this.jobNumberLabel + ' (required)'
    }
  },
  async mounted() {
    await this.getJobNumbers(this.initialJobNumber)
    if (this.searchOptions) {
      const job = this.searchOptions.find((j) => {
        return j.JobCode === this.initialJobNumber
      })
      await this.jobNumberSelected(job)
    }
  },
  methods: {
    //Call back function whenever jobNumber in the text field changes
    jobNumberChanged(jobNumber) {
      this.jobNumber = jobNumber
      this.jobName = null
      //The timeout waits for the user to stop typing before running the search
      clearTimeout(this.timeout)
      const self = this
      this.timeout = setTimeout(function () {
        self.getJobNumbers(jobNumber)
      }, 600)
    },
    jobNumberSelected(jobObject) {
      this.jobNumber = null
      const self = this
      //This tricks the text field to think the jobNumber field updated and reruns the validation
      setTimeout(() => {
        this.jobName = jobObject.JobNameLong
        this.jobNumber = jobObject.JobCode
        this.jobNumberAndName = this.jobName + ' ' + this.jobNumber
        this.projectInfo = jobObject.Project
        self.$emit('jobObjectSelected', jobObject)
      }, 1)
    },
    validateJobNumber(jobNumber) {
      if (this.jobNumberRequired) {
        if (!jobNumber) {
          return 'Job number required'
        }
      }

      if (
        jobNumber === '00000000' ||
        jobNumber === '12345678' ||
        jobNumber === '12345600' ||
        jobNumber === '99999999'
      ) {
        return 'Do not use this job number'
      }

      return true
    },
    async getJobNumber(jobQuery) {
      if (jobQuery) {
        const query = jobQuery.replace('-', '')
        const token = localStorage.getItem('AuthToken')
        const res = await fetch(`http://localhost:3000/api/jobnumber/${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (res.status !== 200) {
          console.log(await res.text())
          return
        } else {
          return res.json()
        }
      }
    },
    async getJobNumbers(jobQuery) {
      let jobNumbers
      this.loading = true
      this.searchError = false
      try {
        jobNumbers = await this.getJobNumber(jobQuery)
      } catch (e) {
        this.searchError = true
        console.error(
          'getJobNumber: Failed to get job number: ' + jobQuery + ' with error: ' + e
        )
      }
      this.loading = false
      if (jobNumbers) {
        this.searchOptions = jobNumbers.jobs
      }
    }
  }
}
</script>
