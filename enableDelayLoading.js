/**
 * 开启请求延迟loading
 * 使用方法: 在app.js中调用enableDelayLoading()
 * 例如:
 * App({
 *  onLaunch() {
 *    enableDelayLoading({
 *      pages: ['pages/index/index', 'pages/detail/detail'], // 指定页面
 *      witeListUrl: ['https://api.xxx.com/xxx'] // 指定请求白名单
 *    })
 *  }
 * })
 * 
 * Author: yonatan<https://github.com/yonatan-d>
 * Date: 2024-05
 */

let requestCount = 0;

function setReqDelay(time = 500) {
  requestCount++;
  // 延时展示loading
  const timer = setTimeout(() => {
    requestCount !== 0 && wx.showLoading({ title: 'loading', isdelayloading: true });
    clearTimeout(timer);
  }, time);
}

function endReq() {
  requestCount--;
  if (requestCount === 0) {
    wx.hideLoading({ isdelayloading: true });
  }
}

export default function enableDelayLoading({ pages = [], witeListUrl = [] }) {
  wx = wxProxy(wx);
  
  function wxProxy(wx) {
    // 检查是否指定页面
    const checkIsMatch = () => {
      const curPages = getCurrentPages();
      const curPage = curPages[curPages.length - 1];
      const isMatch = pages.includes(curPage?.route);
      return isMatch;
    }
    const newWx = { ...wx };

    // 代理showLoading/hideLoading，识别到标志位就屏蔽调用
    const loadingApiProxy = (loadingApi) => {
      return (object) => {
        if (checkIsMatch) {
          if (object?.isdelayloading) {
            delete object.isdelayloading;
            return loadingApi(object);
          }
          return () => {};
        }
        return loadingApi(object);
      }
    }

    // 重写request，记录请求数，所有请求结束时才关闭loading
    newWx.request = (function requestProxy(request) {
      return function newRequest(object) {
        // 匹配到传入的pages，就走记录请求数的流程
        if (checkIsMatch()) {
          // 未匹配到传入的白名单url列表，就不记录请求数（加1）
          if (witeListUrl.every(url => object.url.indexOf(url) < 0)) {
            setReqDelay();
          }

          return request({
            ...object,
            complete: () => {
              // 未匹配到传入的白名单url列表，就不记录请求数（减1）
              if (witeListUrl.every(url => object.url.indexOf(url) < 0)) {
                endReq();
              }
              typeof object.complete === 'function' && object.complete();
            }
          })
        }
        return request(object);
      }
    })(wx.request);

    // 重写showLoading，屏蔽指定页面下的调用
    newWx.showLoading = loadingApiProxy(wx.showLoading);

    // 重写hideLoading，屏蔽指定页面下的调用
    newWx.hideLoading = loadingApiProxy(wx.hideLoading);

    return newWx;
  }
}
