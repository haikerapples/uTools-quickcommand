<template>
  <div class="wrapper">
    <!-- logo -->
    <div class="row items-center q-gutter-sm">
      <q-avatar
        square
        size="38px"
        :class="{
          featureIco: 1,
          featureIcoHover: isHovered,
          'feature-disabled': !isActivated,
        }"
      >
        <img :src="commandInfo.features.icon" />
      </q-avatar>
      <div class="col">
        <!-- 名称 -->
        <div class="text-ellipsis">
          <span class="name-label" style="color: white; font-size: 16px">指令名称：</span>
          <span v-html="purify(commandInfo.features.explain)" />
        </div>
        <div class="text-keyword" style="display: flex; align-items: center; gap: 4px;">
          <span class="name-label" style="color: white; font-size: 16px">指令标签：</span>
          <!-- 匹配模式 -->
          <CommandTypeTag
            :cmds="commandInfo.features.cmds"
            :isGrayColor="!isPlatformSupported || !isActivated"
            :cardStyleCode="cardStyleCode"/>
        </div>
      </div>
    </div>
    <!-- 语言类型 -->
    <div
      :class="{
        'platform-icons': 1,
        'platform-icons-disabled': !isActivated,
      }"
    >
      <q-img
        v-for="platform in commandInfo.features.platform"
        :key="platform"
        :src="platformTypes[platform].icon"
        width="16px"
      />
      <div>|</div>
      <q-img :src="program.icon" width="16px" />
      <div class="text-subtitle2">{{ program.name }}</div>
    </div>
  </div>
</template>

<script>
import CommandTypeTag from "../CommandTypeTag.vue";
import platformTypes from "js/options/platformTypes.js";
import programs from "js/options/programs.js";

export default {
  name: "ListLayout",
  components: { CommandTypeTag },
  props: {
    commandInfo: Object,
    isActivated: Boolean,
    isPlatformSupported: Boolean,
    isHovered: Boolean,
    cardStyleCode: Number,
  },
  data() {
    return {
      platformTypes,
      programs,
    };
  },
  computed: {
    program() {
      if (this.commandInfo.program === "quickcomposer") {
        return {
          ...this.programs.quickcommand,
          name: "可视化编排",
        };
      }
      return this.programs[this.commandInfo.program];
    },
  },
  methods: {
    purify(content) {
      return window.DOMPurify.sanitize(content);
    },
  },
};
</script>

<style scoped>
/* 网格布局 */
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-size: 16px;
  font-weight: bold;
}

.name-label {
  color: #666;
  font-weight: normal;
}
</style>
