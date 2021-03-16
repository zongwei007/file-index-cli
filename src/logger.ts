class Logger {
  private verbose = false;

  setVerbose(flag: boolean) {
    this.verbose = flag;
  }

  // deno-lint-ignore no-explicit-any
  debug(...args: any[]) {
    if (this.verbose) {
      console.log(...args);
    }
  }
}

const logger = new Logger();

export default logger;
