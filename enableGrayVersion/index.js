/**
 * 开启灰度版本
 * 简介: 一个用于小程序在灰度版本和正式版本之间切换的工具。
 * 根据用户信息里的地区编码、手机号前缀、白名单等规则来决定用户是否应该访问灰度版本。
 * 准备: 
 * 1.新增grayVersion子包, 里面存放灰度版本页面, 路径层级与原来保持一致
 * 2.后端配置灰度版本策略, 接口返回 GrayRule 对象
 * 使用方法: 
 * 1.把app.json配置的grayVersion子包页面路径, 拷贝至grayPages.js中
 * 2.在app.js中调用enableGrayVersion()
 * 3.登录之后, 调用setGrayVersionStorage(userInfo)设置用户信息(会异步更新灰度策略)
 * 例如:
 * import { enableGrayVersion, setGrayVersionStorage } from './enableGrayVersion';
 * App({
 *   onLaunch: function () {
 *     // 正常使用:
 *     enableGrayVersion({
 *       isOpen: true,
 *     });
 *     // 前端测试使用:
 *     // enableGrayVersion({
 *     //   isTest: true, // 设置表示使用以下配置
 *     //   isOpen: true,
 *     //   areaCode: ['110000', '310000'],
 *     //   phonePrefix: '138',
 *     //   whiteList: ['13800138000'],
 *     //   // all: true,
 *     // });
 *     // ...
 *     const userInfo = login(); // 获取用户信息
 *     setGrayVersionStorage(userInfo); // 设置用户信息(会异步更新灰度策略)
 *   },
 * })
 * 其它方法: 
 * setGrayVersionStorageSync(userInfo) - 同步设置用户信息(从前端storage缓存获取灰度策略)
 * isGrayVersionSync() - 是否为灰度版本
 * redirectToGrayPage(grayPages, userInfo) - 切换用户后调用, 重定向到灰度或非灰度页面
 * 
 * Author: yonatan<https://github.com/yonatan-d>
 * Date: 2024-05
 */
import GRAY_PAGES from './grayPages.js';
const SUBPACKAGES_ROOT = 'grayVersion';
let isGrayVersionOpen = false;

/**
 * @typedef UserInfo
 * @property {string} areaCode 地区编码
 * @property {string} mobilePhone 手机号
 * @property {string} userId 用户id
 * @property {string} userName 用户名
 * @property {string} userAvatar 用户头像
 * @property {string} userRole 用户角色
 * @property {string} userStatus 用户状态
 */

/**
 * @typedef GrayRule
 * @property {boolean} isOpen 是否开启灰度版本
 * @property {string[]} areaCode 地区编码
 * @property {string} phonePrefix 手机号前缀
 * @property {string[]} whiteList 白名单（手机号）
 * @property {boolean} all 是否全部用户访问
 */

/**
 * @typedef TargetUserParams
 * @property {GrayRule} rule 规则
 * @property {UserInfo} userInfo 用户信息
 */

/**
 * @typedef RedirectToGrayPageParams
 * @property {string[]} grayPages 页面路径
 * @property {UserInfo} userInfo 用户信息
 */

/**
 * 检查是否为灰度目标用户
 * @param {TargetUserParams} targetUserParams 目标用户参数
 * @returns {boolean}
 */
function checkIsGrayVersionTargetUser(targetUserParams) {
  const { rule, userInfo } = targetUserParams;
  const {
    isOpen = false,
    areaCode = [],
    phonePrefix = "",
    whiteList = [],
    all = false,
  } = rule;

  // 未开启灰度版本
  if (!isOpen) return false;
  // 全部用户
  if (all) return true;
  if (areaCode.length >= 1 && areaCode[0] === 'all') return true; // 取第一项
  // 命中地区编码
  const userAreaCode = userInfo?.areaCode || '';
  if (areaCode.some(code => userAreaCode.startsWith(code))) return true;
  // 命中手机号前缀
  const userMobilePhone = userInfo?.mobilePhone || '';
  if (phonePrefix?.length > 0 && userMobilePhone.startsWith(phonePrefix)) return true;
  // 命中白名单
  if (whiteList.includes(userMobilePhone)) return true;

  return false;
}

/**
 * 是否为灰度版本，同步，读storage缓存
 * @returns {boolean}
 */
export function isGrayVersionSync() {
  const grayVersionStorage = wx.getStorageSync('GRAY_VERSION');
  return grayVersionStorage.isGrayVersion || false;
}

/**
 * 跳转到灰度版本页面
 * @param {RedirectToGrayPageParams} redirectToGrayPageParams 跳转参数
 * @returns {boolean} 是否跳转成功
 */
export function redirectToGrayPage(redirectToGrayPageParams) {
  const { grayPages = [], userInfo } = redirectToGrayPageParams;
  // 如果灰度版本未开启，直接返回
  if (!isGrayVersionOpen) return false;

  // 获取灰度版本规则
  const rule = wx.getStorageSync('GRAY_VERSION');
  // 检查用户是否为目标用户
  const isTargetUser = checkIsGrayVersionTargetUser({ rule, userInfo });
  // 检查当前版本是否为灰度版本
  const isGrayVersion = isGrayVersionSync();
  // 如果用户和版本状态一致，不需要跳转 (新切旧、旧切新才需要跳转)
  const isRedirect = isTargetUser !== isGrayVersion;

  // 更新灰度版本状态
  wx.setStorageSync('GRAY_VERSION', Object.assign({}, rule, { isGrayVersion: isTargetUser }));

  // 获取当前页面
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  let url = currentPage?.route || '';

  // 如果当前页面不需要切换刷新，直接返回
  const isGrayPage = grayPages.some(page => url.startsWith(page));
  if (!isGrayPage) return false;

  // 获取页面参数
  const options = wx.getEnterOptionsSync();
  const urlParams = Object.keys(options.query).length > 0
    ? ('?' + Object.entries(options.query).map(v => `${v[0]}=${v[1]}`).join('&'))
    : '';

  // 移除灰度包前缀
  if (url.startsWith(SUBPACKAGES_ROOT)) {
    url = url.slice(SUBPACKAGES_ROOT.length + 1);
  }

  // 根据用户和版本状态跳转到相应的页面
  if (isRedirect) {
    // 跳灰度版本
    if (isGrayPage && isTargetUser) {
      wx.redirectTo({
        url: '/' + SUBPACKAGES_ROOT + '/' + url + urlParams,
        notProxy: true,
      })
      return true;
    }
    // 跳旧版本
    if (isGrayPage && !isTargetUser) {
      wx.redirectTo({
        url: '/' + url + urlParams,
        notProxy: true,
      })
      return true
    }
  }

  return false;
}

/**
 * 异步设置缓存isGrayVersion
 * @param {UserInfo} userInfo 用户信息
 */
export async function setGrayVersionStorage(userInfo) {
  // 如果灰度版本未开启，直接返回
  if (!isGrayVersionOpen) return;

  const rule = await getGrayVersionRule(); // 调用异步方法从后台获取灰度策略
  const isTargetUser = checkIsGrayVersionTargetUser({ rule, userInfo });
  wx.setStorageSync('GRAY_VERSION', Object.assign({}, rule, { isGrayVersion: isTargetUser }));
}

/**
 * 同步设置缓存isGrayVersion
 * @param {UserInfo} userInfo 用户信息
 */
export function setGrayVersionStorageSync(userInfo) {
  // 如果灰度版本未开启，直接返回
  if (!isGrayVersionOpen) return;

  const rule = wx.getStorageSync('GRAY_VERSION'); // 调用同步方法从缓存获取灰度策略
  const isTargetUser = checkIsGrayVersionTargetUser({ rule, userInfo });
  wx.setStorageSync('GRAY_VERSION', Object.assign({}, rule, { isGrayVersion: isTargetUser }));
}

/**
 * 获取灰度策略
 * @returns {GrayRule}
 */
function getGrayVersionRule() {
  // 灰度策略
  // return {
  //   isOpen: true, // 灰度开关
  //   areaCode: [], // 地区编码
  //   phonePrefix: '', // 手机号前缀
  //   whiteList: [], // 白名单（手机号）
  //   all: false, // 全部用户
  // }
  return new Promise(async (resolve, reject) => {
    const grayVersionRule = wx.getStorageSync('GRAY_VERSION') || {};
    // 用于测试的灰度配置
    if (grayVersionRule.isTest) {
      resolve(grayVersionRule);
      return;
    }
    try {
      const res = await fetch('/api/grayVersionRule'); // 获取灰度策略配置的接口
      const data = await res.json();
      if (data.code === 200) {
        wx.setStorageSync('GRAY_VERSION', data.data);
        resolve(data.data);
      } else {
        resolve({ isOpen: false });
      }
    } catch (error) {
      console.error('getGrayVersionRule error', error);
      resolve({ isOpen: false });
    }
  })
}

/**
 * 开启灰度版本
 * @param {GrayRule} grayRule 
 */
export function enableGrayVersion(grayRule = {}) {
  wx.removeStorageSync('GRAY_VERSION');
  if (!grayRule.isOpen) {
    isGrayVersionOpen = false;
    return;
  } else {
    isGrayVersionOpen = true;
  }
  // 测试时的灰度规则
  if (grayRule.isTest) {
    wx.setStorageSync('GRAY_VERSION', grayRule);
  }
  // 代理wx对象，拦截API: navigateTo、redirectTo、reLaunch
  wx = wxProxy(wx);
  // 全局路由拦截，做灰度版本判断，给拦截API兜底
  // wx.onAppRoute((route) => {
  //   if (GRAY_PAGES.some(p => route.path.startsWith(p)) && isGrayVersionSync()) {
  //     const urlParams = Object.keys(route.query).length > 0
  //       ? ('?' + Object.entries(route.query).map(v => `${v[0]}=${v[1]}`).join('&'))
  //       : '';
  //     wx.redirectTo({
  //       url: '/' + SUBPACKAGES_ROOT + '/' + route.path + urlParams
  //     })
  //   }
  // })
}

/**
 * 把页面相对路径处理成绝对路径
 * @param {string} base 
 * @param {string} relative 
 * @returns {string} 
 */
const fixRelativeUrl = (base, relative) => {
  if (relative.startsWith('/')) {
    return relative.replace('/', '');
  }

  let stack = base.split('/');
  let parts = relative.split('/');
  stack.pop(); // 去掉当前文件名

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] == '.') continue;
    if (parts[i] == '..') stack.pop();
    else stack.push(parts[i]);
  }

  return stack.join('/');
}

/**
 * 代理路由跳转的API
 * 跳转前检查是灰度就修改url
 * @param {Function} wxRouteApi - 原始的路由处理函数 ['navigateTo', 'redirectTo', 'reLaunch']
 * @returns {Function} - 代理后的路由处理函数
 */
function routeApiProxy(wxRouteApi) {
  return function newWxRouteApi(object) {
    // 如果不需要代理，直接调用原始的路由处理函数
    if (object.notProxy) {
      return wxRouteApi(object);
    }
    // 获取当前页面路径
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const source = currentPage.route;
    let { url } = object;
    // 修复相对路径
    url = fixRelativeUrl(source, url);

    // 移除灰度包前缀
    const grayPrefix = SUBPACKAGES_ROOT + '/';
    if (url.startsWith(grayPrefix)) {
      url = url.substring(grayPrefix.length);
    }

    // 检查当前页面是否在灰度页面列表中
    const isGrayPage = GRAY_PAGES.some(p => url.startsWith(p));
    // 检查当前版本是否为灰度版本
    const isGrayVersion = isGrayVersionSync();

    // 根据灰度页面和版本信息调整url
    if (isGrayPage && isGrayVersion) {
      url = '/' + SUBPACKAGES_ROOT + '/' + url;
    } else {
      url = '/' + url;
    }

    // 调用原始的路由处理函数，并传入修改后的url
    return wxRouteApi({ ...object, url });
  }
}

/**
 * 代理 navigateTo 方法
 * @param {Function} navigateTo 
 * @returns {Function}
 */
function navigateToProxy(navigateTo) {
  return routeApiProxy(navigateTo);
}

/**
 * 代理 redirectTo 方法
 * @param {Function} redirectTo 
 * @returns {Function}
 */
function redirectToProxy(redirectTo) {
  return routeApiProxy(redirectTo);
}

/**
 * 代理 reLaunch 方法
 * @param {Function} reLaunch 
 * @returns {Function}
 */
function reLaunchProxy(reLaunch) {
  return routeApiProxy(reLaunch);
}

/**
 * 代理 wx 对象
 * 重写 navigateTo, redirectTo, reLaunch 方法
 * @param {WechatMiniprogram.Wx} wx 
 * @returns WechatMiniprogram.Wx
 */
export function wxProxy(wx) {
  const newWx = { ...wx };
  newWx.navigateTo = navigateToProxy(wx.navigateTo);
  newWx.redirectTo = redirectToProxy(wx.redirectTo);
  newWx.reLaunch = reLaunchProxy(wx.reLaunch);
  return newWx;
}
