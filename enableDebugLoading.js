/**
 * 开启调试loading
 * 使用方法: 在app.js中调用DebugLoading()
 * 例如:
 * import DebugLoading from './DebugLoading';
 * App({
 *   onLaunch: function () {
 *     DebugLoading();
 *   }
 * })
 * 
 * Author: yonatan<https://github.com/yonatan-d>
 * Date: 2024-05
 */
export default function enableDebugLoading(isOpen = true) {
  if (!isOpen) {
    return;
  }

  wx = wxProxy(wx);

  function wxProxy(wx) {
    const newWx = { ...wx };

    // 代理showLoading/hideLoading
    const loadingApiProxy = (loadingApi) => {
      return (object) => {
        console.trace();
        debugger
        return loadingApi(object);
      }
    }

    // 代理wx.showLoading
    newWx.showLoading = loadingApiProxy(wx.showLoading);

    // 代理wx.hideLoading
    newWx.hideLoading = loadingApiProxy(wx.hideLoading);

    return newWx;
  }
}
