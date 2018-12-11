'use strict'

process.env.NODE_ENV = 'production'

const { say } = require('cfonts')
const copydir = require('copy-dir')
const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const del = require('del')
const packager = require('electron-packager')
const webpack = require('webpack')
const Multispinner = require('multispinner')

const buildConfig = require('./build.config')
const mainConfig = require('./webpack.main.config')
const rendererConfig = require('./webpack.renderer.config')
const webConfig = require('./webpack.web.config')

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '
const okayLog = chalk.bgBlue.white(' OKAY ') + ' '
const isCI = process.env.CI || false

if (process.env.BUILD_TARGET === 'clean') clean()
else if (process.env.BUILD_TARGET === 'web') web()
else build()

function clean () {
  del.sync(['build/*', '!build/icons', '!build/icons/icon.*'])
  console.log(`\n${doneLog}\n`)
  process.exit()
}

function build () {
  createBuildInfo()
  greeting()

  del.sync(['dist/electron/*', '!.gitkeep'])

  const tasks = ['main', 'renderer']
  const m = new Multispinner(tasks, {
    preText: 'building',
    postText: 'process'
  })

  let results = ''

  m.on('success', () => {
    process.stdout.write('\x1B[2J\x1B[0f')
    console.log(`\n\n${results}`)
    console.log(`${okayLog}take it away ${chalk.yellow('`electron-packager`')}\n`)
    bundleApp().then(result => {
      buildAppSuccess(result)
    }).catch(err => {
      process.exit(1)
    })
  })

  pack(mainConfig).then(result => {
    results += result + '\n\n'
    m.success('main')
  }).catch(err => {
    m.error('main')
    console.log(`\n  ${errorLog}failed to build main process`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })

  pack(rendererConfig).then(result => {
    results += result + '\n\n'
    m.success('renderer')
  }).catch(err => {
    m.error('renderer')
    console.log(`\n  ${errorLog}failed to build renderer process`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })
}
function createBuildInfo() {
  fs.writeFileSync(path.resolve(__dirname, "../src/renderer/common/BuildInfo.js"), `
export const BuildInfo = {
  date : new Date(${new Date().valueOf()})
}
  `)
  // var info = {
  //   "date" : new Date().getTime()
  // }
  // var strInfo = JSON.stringify(info)
  // console.log("写入信息 : " + strInfo)
  // for (var appPath of appPaths) {
  //   var dir = getResourcePath(appPath)
  //   try {
  //     fs.writeFileSync(path.resolve(dir, "info.json"), strInfo)
  //   } catch (e) {
  //     console.log(e)
  //   }
  // }
}


function pack (config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) reject(err.stack || err)
      else if (stats.hasErrors()) {
        let err = ''

        stats.toString({
          chunks: false,
          colors: true
        })
        .split(/\r?\n/)
        .forEach(line => {
          err += `    ${line}\n`
        })

        reject(err)
      } else {
        resolve(stats.toString({
          chunks: false,
          colors: true
        }))
      }
    })
  })
}
function web () {
  del.sync(['dist/web/*', '!.gitkeep'])
  webpack(webConfig, (err, stats) => {
    if (err || stats.hasErrors()) console.log(err)

    console.log(stats.toString({
      chunks: false,
      colors: true
    }))

    process.exit()
  })
}

function greeting () {
  const cols = process.stdout.columns
  let text = ''

  if (cols > 85) text = 'lets-build'
  else if (cols > 60) text = 'lets-|build'
  else text = false

  if (text && !isCI) {
    say(text, {
      colors: ['yellow'],
      font: 'simple3d',
      space: false
    })
  } else console.log(chalk.yellow.bold('\n  lets-build'))
  console.log()
}

function bundleApp () {
  return new Promise((resolve, reject) => {
    packager(buildConfig, (err, appPaths) => {
      if (err) {
        console.log(`\n${errorLog}${chalk.yellow('`electron-packager`')} says...\n`)
        console.log(err + '\n')
        reject(err)
      } else {
        console.log(`\n${doneLog}\n`)
        resolve(appPaths)
      }
    })
  })
}
function getResourcePath(appPath) {
  if (buildConfig.platform == "win32") {
    return path.resolve(appPath, "resources/")
  } else if (buildConfig.platform == "darwin") {
    return path.resolve(appPath, "ScorpioPackageTool.app/Contents/Resources/")
  } else {
    return path.resolve(appPath, "resources/")
  }
}
function buildAppSuccess(appPaths) {
  copyTool(appPaths)
}
function copyTool(appPaths) {
  for (var appPath of appPaths) {
    var dir = getResourcePath(appPath)
    console.log("复制所有工具 : " + dir)
    copydir.sync(path.resolve(process.cwd(), "tools"), path.resolve(dir, "tools"))
  }
}
