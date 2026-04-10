import chalk from 'chalk';
import ora from 'ora';

const logger = {
  info(msg) {
    console.log(chalk.blue('i'), msg);
  },

  success(msg) {
    console.log(chalk.green('✓'), msg);
  },

  error(msg) {
    console.log(chalk.red('✗'), msg);
  },

  warn(msg) {
    console.log(chalk.yellow('!'), msg);
  },

  step(num, msg) {
    console.log(chalk.gray(`  ${num}.`), msg);
  },

  dim(msg) {
    console.log(chalk.dim(msg));
  },

  spinner(msg) {
    return ora({ text: msg, color: 'cyan' }).start();
  },

  banner() {
    console.log(chalk.bold.cyan('\n  runly') + chalk.dim(' — natural language to playwright tests\n'));
  },
};

export default logger;
