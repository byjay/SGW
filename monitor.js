const chokidar = require('chokidar');
const { exec } = require('child_process');

class AutoMonitor {
  constructor(options = {}) {
    this.distPath = options.distPath || 'dist';
    this.interval = options.interval || 10 * 60 * 1000; // 10분 (기본값)
    this.autoDeploy = options.autoDeploy !== false;
    this.buildCommand = options.buildCommand || 'npm run build';
    this.deployCommand = options.deployCommand || 'npx wrangler pages deploy dist --project-name sgw-seastar-work';
    this.deployOnly = options.deployOnly || false;

    this.isDeploying = false;
    this.lastDeployTime = 0;
    this.watchers = [];
    this.buildTimeout = null;
    this.deployTimeout = null;
  }

  async init() {
    console.log('🚀 Auto Monitor 시작됩니다...');
    console.log(`📁 감지 폴더: ${this.distPath}`);
    console.log(`⏱️ 체크 간격: ${this.interval / 60000}분`);
    console.log(`🚀 자동 배포: ${this.autoDeploy ? '켜짝' : '끌짝'}`);

    if (this.autoDeploy) {
      this.startWatch();
      this.startScheduler();
    } else if (this.deployOnly) {
      await this.deployOnce();
    } else {
      console.log('⚠️ 감지만 자동 배포는 비활성화되어 있습니다. 자동 배포를 활성화하려면 `npm run start` 명령을 사용하세요.');
      this.startWatch();
    }
  }

  startWatch() {
    console.log('👀 파일 감지 시작...');
    console.log('ℹ️ 주의: 감시할 파일이 수정되면 자동으로 빌드 및 배포됩니다.');

    const watcher = chokidar.watch(this.distPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: false
    });

    watcher.on('all', (event, path) => {
      if (this.isDeploying) {
        console.log('⏸ 이미 배포 중입니다. 파일 변경 감시됨:', path);
        return;
      }
      this.handleFileChange(event, path);
    });

    this.watchers.push(watcher);
    console.log('✅ 파일 감시 활성화되었습니다.');
  }

  startScheduler() {
    console.log('⏰ 스케줄러 시작...');
    console.log(`⏱️ 주기: ${this.interval / 60000}마다 자동 배포 실행`);

    setInterval(async () => {
      if (!this.isDeploying && this.autoDeploy) {
        console.log('🔄 주기 배포 실행...');
        await this.deployOnce();
      }
    }, this.interval);
  }

  async handleFileChange(event, path) {
    console.log(`📝 파일 변경 감지됨: ${event} - ${path}`);

    if (this.autoDeploy) {
      console.log('🔄 자동 빌드 및 배포 시작...');
      await this.deployOnce();
    }
  }

  async deployOnce() {
    if (this.isDeploying) {
      console.log('⏸ 이미 배포 중입니다. 건너�니다.');
      return;
    }

    this.isDeploying = true;
    console.log('🔨 배포 중...');

    try {
      // 1. 빌드
      await this.build();
      this.lastBuildTime = Date.now();

      // 2. 배포
      await this.deploy();

      console.log('✅ 배포 완료!');
      this.isDeploying = false;
    } catch (error) {
      console.error('❌ 배포 실패:', error.message);

      // 10분 대기 후 재시도
      this.buildTimeout = setTimeout(() => {
        this.isDeploying = false;
        console.log('🔄 10분 후 재시도합니다...');
      }, 10 * 60 * 1000);

      this.deployTimeout = setTimeout(() => {
        console.log('🔄 재시도 배포를 시작합니다...');
        this.isDeploying = true;
      }, 15 * 60 * 1000);
    }
  }

  async build() {
    console.log('📦 빌드 중...');
    
    return new Promise((resolve, reject) => {
      const build = exec(this.buildCommand, { cwd: __dirname });

      let output = '';
      let error = '';

      build.stdout.on('data', (data) => {
        output += data;
        process.stdout.write(data);
      });

      build.stderr.on('data', (data) => {
        output += data;
        process.stderr.write(data);
      });

      build.on('close', (code) => {
        if (code !== 0) {
          error = output.substring(output.lastIndexOf('\n'));
        }
      });

      build.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ 빌드 성공!');
          resolve();
        } else {
          reject(new Error(`빌드 실패 (exit code ${code})`));
        }
      });
    });
  }

  async deploy() {
    console.log('☁️ 배포 중...');
    
    return new Promise((resolve, reject) => {
      const deploy = exec(this.deployCommand, { cwd: __dirname });

      let output = '';
      let error = '';

      deploy.stdout.on('data', (data) => {
        output += data;
        process.stdout.write(data);
      });

      deploy.stderr.on('data', (data) => {
        output += data;
        process.stderr.write(data);
      });

      deploy.on('close', (code) => {
        if (code !== 0) {
          error = output.substring(output.lastIndexOf('\n'));
        }
      });

      deploy.on('exit', (code) => => {
        if (code === 0) {
          console.log('✅ 배포 성공!');
          this.lastDeployTime = Date.now();
          resolve();
        } else {
          reject(new Error(`배포 실패 (exit code ${code})`));
        }
      });
    });
  }

  stop() {
    console.log('⏹️ 모니터링 정지 중...');

    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];

    if (this.buildTimeout) clearTimeout(this.buildTimeout);
    if (this.deployTimeout) clearTimeout(this.deployTimeout);

    console.log('✅ 모든 작업이 중단되었습니다.');
  }
}

// CLI 실행
if (require.main === module) {
  const deployOnly = process.argv.includes('--deploy-only');
  const autoDeploy = !deployOnly;

  const monitor = new AutoMonitor({
    distPath: 'dist',
    interval: 10 * 60 * 1000, // 10분
    autoDeploy: autoDeploy,
    deployOnly: deployOnly
  });

  // 인터럽트 핸들링을 처리
  process.on('SIGINT', () => {
    console.log('\n👋 SIGINT 수신. 정리 중...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM 수신. 정리 중...');
    monitor.stop();
    process.exit(0);
  });

  // 시작
  monitor.init();
}
