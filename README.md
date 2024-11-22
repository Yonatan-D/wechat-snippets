一些用在微信小程序的工具方法实践

- `enableDebugLoading` - 跟踪 wx.showLoading 和 wx.hideLoading 的调用时机

- `enableDelayLoading` - 开启延迟 loading, 避免频繁调用 wx.showLoading 和 wx.hideLoading 造成闪烁

- `enableGrayVersion` - 开启灰度版本和正式版本的切换，根据用户信息里的地区编码、手机号前缀、白名单等规则来决定用户是否应该访问灰度版本
