<template>
  <div class="script-editor">
    <!-- 代码编辑器 -->
    <CodeEditor
      ref="codeEditor"
      :model-value="argvs.code"
      @update:modelValue="updateArgvs('code', $event)"
      :language="argvs.language"
    />
    <div class="row q-col-gutter-sm">
      <!-- 语言选择 -->
      <q-select
        :model-value="argvs.language"
        @update:modelValue="updateArgvs('language', $event)"
        :options="programOptions"
        label="编程语言"
        filled
        dense
        options-dense
        class="col"
      >
        <template v-slot:append>
          <q-avatar size="sm" square>
            <img :src="programs[argvs.language].icon" />
          </q-avatar>
        </template>
        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section avatar>
              <img width="24" :src="programs[scope.opt].icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label v-html="scope.opt" />
            </q-item-section>
          </q-item>
        </template>
      </q-select>
      <q-field filled dense class="col-auto variable-list-field">
        <VariableList
          label="插入变量"
          :show-variable-list="true"
          :show-function-list="false"
          :show-global-variables="true"
          @emit-value="insertVariable"
        />
        <q-tooltip>
          <div>引入当前流程的变量到代码中</div>
          <div class="text-primary" v-if="!isCodeSnippet">
            注意，所有变量的值都是以<span class="text-weight-bold">字符串</span
            >的形式传入，不要删除两边的引号
          </div>
        </q-tooltip>
      </q-field>

      <!-- 编码设置 -->
      <q-select
        class="col-3"
        filled
        dense
        options-dense
        v-if="!isCodeSnippet"
        :model-value="argvs.scriptCode"
        @update:modelValue="updateArgvs('scriptCode', $event)"
        label="脚本文件编码"
        :options="charsetOptions"
        emit-value
        map-options
      />
      <q-select
        class="col-3"
        filled
        dense
        options-dense
        v-if="!isCodeSnippet"
        :model-value="argvs.outputCode"
        @update:modelValue="updateArgvs('outputCode', $event)"
        label="命令行输出编码"
        :options="charsetOptions"
        emit-value
        map-options
      />
    </div>

    <div class="row q-col-gutter-sm" v-if="!isCodeSnippet">
      <div class="col-6">
        <ArrayEditor
          topLabel="脚本参数"
          :model-value="argvs.args"
          @update:modelValue="updateArgvs('args', $event)"
        />
      </div>
      <!-- 终端运行设置 -->
      <div class="col-6">
        <BorderLabel label="终端运行设置">
          <div class="row q-col-gutter-sm">
            <CheckButton
              :model-value="!!argvs.runInTerminal"
              @update:modelValue="toggleTerminal"
              label="在终端中运行"
            />

            <template v-if="argvs.runInTerminal">
              <VariableInput
                :model-value="argvs.runInTerminal.dir"
                @update:modelValue="updateTerminal('dir', $event)"
                :options="{
                  dialog: {
                    type: 'open',
                    properties: ['openDirectory'],
                  },
                }"
                label="运行目录"
              />
              <div class="col">
                <div class="row q-col-gutter-sm">
                  <q-select
                    :model-value="argvs.runInTerminal.windows"
                    @update:modelValue="updateTerminal('windows', $event)"
                    :options="windowsTerminalOptions"
                    label="Windows终端"
                    filled
                    dense
                    options-dense
                    emit-value
                    map-options
                    class="col-6"
                  />

                  <q-select
                    :model-value="argvs.runInTerminal.macos"
                    @update:modelValue="updateTerminal('macos', $event)"
                    :options="macosTerminalOptions"
                    label="macOS终端"
                    filled
                    dense
                    options-dense
                    emit-value
                    map-options
                    class="col-6"
                  />
                </div>
              </div>
              <CheckButton
                :model-value="!!argvs.runInTerminal.reuseWindow"
                @update:modelValue="updateTerminal('reuseWindow', $event)"
                label="复用终端窗口"
              >
                <q-tooltip
                  anchor="center right"
                  self="center left"
                  class="multiline"
                  max-width="320px"
                >
                  <div class="text-weight-medium q-mb-xs">终端窗口复用功能</div>
                  <div class="q-mb-xs">相同终端的任务将在同一窗口的不同标签页中运行</div>
                  <div class="text-grey-6 q-mb-xs">✅ 支持：iTerm、Windows Terminal、macOS系统终端</div>
                  <div class="text-orange-6 q-mb-xs">⚠️ 注意：macOS系统终端需要授予辅助功能权限</div>
                  <div class="text-grey-5">📍 系统偏好设置 → 安全性与隐私 → 辅助功能 → 添加uTools</div>
                </q-tooltip>
              </CheckButton>
              <CheckButton
                :model-value="!!argvs.waitForCompletion"
                @update:modelValue="updateArgvs('waitForCompletion', $event)"
                label="等待运行完毕"
              />
              <q-input
                v-if="argvs.waitForCompletion"
                :model-value="argvs.timeout"
                @update:modelValue="updateArgvs('timeout', $event)"
                label="超时时间（秒）"
                type="number"
                filled
                dense
                hint="默认300秒（5分钟）"
                class="col-12"
              />
            </template>
          </div>
        </BorderLabel>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, inject } from "vue";
import { newVarInputVal } from "js/composer/varInputValManager";
import CodeEditor from "components/editor/CodeEditor.vue";
import VariableInput from "components/composer/common/VariableInput.vue";
import ArrayEditor from "components/composer/common/ArrayEditor.vue";
import BorderLabel from "components/composer/common/BorderLabel.vue";
import CheckButton from "components/composer/common/CheckButton.vue";
import { stringifyArgv } from "js/composer/formatString";
import programs from "js/options/programs";
import VariableList from "components/composer/common/varinput/VariableList.vue";

export default defineComponent({
  name: "ScriptEditor",
  components: {
    CodeEditor,
    VariableInput,
    ArrayEditor,
    BorderLabel,
    CheckButton,
    VariableList,
  },
  props: {
    modelValue: Object,
  },
  emits: ["update:modelValue"],
  setup() {
    // 注入当前流程信息、命令索引和编排配置
    const getCurrentFlow = inject("getCurrentFlow", null);
    const commandIndex = inject("commandIndex", null);
    const getCommandConfig = inject("getCommandConfig", null);

    return {
      getCurrentFlow,
      commandIndex,
      getCommandConfig,
    };
  },
  data() {
    return {
      defaultArgvs: {
        code: "",
        language: "shell",
        args: [],
        scriptCode: null,
        outputCode: null,
        runInTerminal: {
          dir: null, // 将在getDefaultTerminalConfig中初始化
          windows: "cmd",
          macos: "iterm",
          reuseWindow: true,
        },
        waitForCompletion: true,
        timeout: 300,
      },
      programs: programs,
      windowsTerminalOptions: ["wt", "cmd"],
      macosTerminalOptions: ["warp", "iterm", "terminal"],
      charsetOptions: [
        { label: "自动", value: null },
        { label: "UTF-8", value: "utf-8" },
        { label: "GBK", value: "gbk" },
      ],
    };
  },
  computed: {
    argvs() {
      if (this.modelValue.argvs) {
        return this.modelValue.argvs;
      }

      // 创建默认配置的深拷贝
      const defaultConfig = window.lodashM.cloneDeep(this.defaultArgvs);

      // 正确初始化 runInTerminal.dir
      if (defaultConfig.runInTerminal) {
        defaultConfig.runInTerminal.dir = newVarInputVal("str", "");
      }

      return defaultConfig;
    },
    isCodeSnippet() {
      return this.modelValue.value === "createCodeSnippet";
    },
    programOptions() {
      const startIndex = this.isCodeSnippet ? 1 : 2;
      return Object.keys(programs).slice(startIndex, -1);
    },
  },
  methods: {
    generateCode(argvs = this.argvs) {
      const variables = argvs.code.match(/"?___([^_]+?)___"?/g);
      const replaceStr =
        variables
          ?.map((variable) => {
            if (variable.startsWith('"') && variable.endsWith('"')) {
              return `.replace('${variable}', JSON.stringify(${variable.slice(
                4,
                -4
              )}))`;
            } else {
              return `.replace('${variable}', ${variable.slice(3, -3)})`;
            }
          })
          .join("") || "";
      if (this.isCodeSnippet) {
        return (
          `quickcomposer.coding.base64Decode("${quickcomposer.coding.base64Encode(
            argvs.code
          )}")` + replaceStr
        );
      }
      const options = {
        language: argvs.language,
      };

      if (argvs.scriptCode) {
        options.scriptCode = argvs.scriptCode;
      }

      if (argvs.outputCode) {
        options.outputCode = argvs.outputCode;
      }

      if (argvs.args?.length) {
        options.args = argvs.args;
      }

      if (argvs.runInTerminal) {
        options.runInTerminal = { ...argvs.runInTerminal };
      }

      if (argvs.waitForCompletion) {
        options.waitForCompletion = true;
        if (argvs.timeout) {
          options.timeout = Number(argvs.timeout) * 1000; // 转换为毫秒
        }
      }

      // 添加脚本名称：编排名称 - 用户描述
      if (argvs.runInTerminal) {
        // 获取编排名称（用户在"请输入名称"中输入的值）
        const commandConfig = this.getCommandConfig ? this.getCommandConfig() : null;
        const composerName = commandConfig?.features?.explain || "QuickCommand";

        // 获取用户描述（"单击修改描述"中的值）
        const userDesc = this.modelValue.userComments || "运行脚本";

        const scriptName = `【${composerName}】- ${userDesc}`;
        options.scriptName = scriptName;
      }

      return `${this.modelValue.value}(${stringifyArgv(
        argvs.code
      )}${replaceStr}, ${stringifyArgv(options)})`;
    },
    getSummary(argvs) {
      return this.isCodeSnippet
        ? `${argvs.language}代码片段`
        : `运行${argvs.language}代码`;
    },
    updateArgvs(key, value) {
      const newArgvs = { ...this.argvs, [key]: value };
      this.updateModelValue(newArgvs);
    },
    toggleTerminal(value) {
      const newArgvs = { ...this.argvs };
      newArgvs.runInTerminal = value
        ? {
            dir: newVarInputVal("str", ""),
            windows: "cmd",
            macos: "iterm",
            reuseWindow: true,
          }
        : null;
      this.updateModelValue(newArgvs);
    },
    updateTerminal(key, value) {
      const newTerminal = { ...this.argvs.runInTerminal, [key]: value };
      const newArgvs = { ...this.argvs, runInTerminal: newTerminal };
      this.updateModelValue(newArgvs);
    },
    updateModelValue(argvs) {
      this.$emit("update:modelValue", {
        ...this.modelValue,
        summary: this.getSummary(argvs),
        code: this.generateCode(argvs),
        argvs,
      });
    },
    insertVariable(_, variable) {
      const replaceVar = this.isCodeSnippet
        ? "___" + variable + "___"
        : '"___' + variable + '___"';
      this.$refs.codeEditor.replaceEditorSelection(replaceVar);
    },
  },
  watch: {
    // 监听 userComments 的变化，当用户修改描述后立即重新生成代码
    "modelValue.userComments": {
      handler() {
        // 只有在终端运行模式下才需要重新生成代码（因为终端名称依赖 userComments）
        if (this.argvs.runInTerminal) {
          this.updateModelValue(this.argvs);
        }
      },
    },
  },
  mounted() {
    this.updateModelValue(this.argvs);
  },
});
</script>

<style scoped>
.script-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variable-list-field :deep(.q-field__control) {
  padding: 0;
  color: var(--utools-font-color);
}
</style>
