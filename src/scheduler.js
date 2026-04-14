import cron from 'node-cron';

export class Scheduler {
  constructor(intervalMs, callback) {
    this.intervalMs = intervalMs;
    this.callback = callback;
    this.task = null;
  }

  start() {    
    // Run immediately
    this.runTask();
    
    // Then run at intervals
    this.task = setInterval(() => {
      this.runTask();
    }, this.intervalMs);
  }

  async runTask() {
    try {
      console.log(`[${new Date().toISOString()}] Running scheduled task...`);
      await this.callback();
    } catch (error) {
      console.error('Error in scheduled task:', error.message);
    }
  }

  stop() {
    if (this.task) {
      clearInterval(this.task);
      console.log('Scheduler stopped');
    }
  }
}
