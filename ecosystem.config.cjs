module.exports = {
  apps: [{
    name: 'chuanqi-shengtai',
    script: 'npm',
    args: 'run start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
