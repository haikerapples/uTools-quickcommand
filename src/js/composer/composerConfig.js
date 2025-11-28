import { commandCategories } from "./commands";

let availableCommands = [];
let commandValueMap = {};

// 从commandCategories中提取所有命令
commandCategories.forEach((category) => {
  category.commands.forEach((cmd) => {
    availableCommands.push({
      type: category.label,
      ...cmd,
    });
    commandValueMap[cmd.value] = cmd;

    // 如果命令有subCommands，也添加到commandValueMap中
    if (cmd.subCommands && Array.isArray(cmd.subCommands)) {
      cmd.subCommands.forEach((subCmd) => {
        commandValueMap[subCmd.value] = subCmd;
      });
    }
  });
});

const findCommandByValue = (value) => {
  console.log('[ComposerConfig] findCommandByValue called with value:', value);
  console.log('[ComposerConfig] commandValueMap keys:', Object.keys(commandValueMap));
  console.log('[ComposerConfig] commandValueMap[value]:', commandValueMap[value]);
  return commandValueMap[value];
};

// 输出调试信息
console.log('[ComposerConfig] commandValueMap initialized with', Object.keys(commandValueMap).length, 'commands');
console.log('[ComposerConfig] Sample keys:', Object.keys(commandValueMap).slice(0, 10));

export { availableCommands, commandCategories, findCommandByValue };
