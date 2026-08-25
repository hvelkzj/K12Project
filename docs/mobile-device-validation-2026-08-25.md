# 移动端设备验证记录

日期：2026-08-25

## 微信小程序

环境：微信开发者工具 Stable 2.02.2608050，游客模式，iPhone 12/13 (Pro) 模拟器。

导入目录：`apps/student-mobile/dist/build/mp-weixin/`

账号：`student_101`

结果：

- 构建目录能够直接导入，项目问题面板为 0。
- 学生账号登录成功，首页读取双校区种子中的学生、班级、作业、课件和考勤。
- 课件页读取“分数混合运算讲义”和附件信息。
- 作业详情读取截止规则和教师附件。
- 提交“分数单元练习”成功，提交记录写回真实本地服务；首页待完成数量由 2 变为 1。
- 个人中心显示学生、校区、班级、课程和考勤；退出后返回学生登录页。
- 游客模式对部分微信系统能力使用模拟返回，因此附件系统预览不作为真机文件打开结论。

截图：

- `docs/screenshots/wechat-mini-program-home.png`
- `docs/screenshots/wechat-mini-program-courseware.png`
- `docs/screenshots/wechat-mini-program-submission.png`

## Android APP

环境：HBuilderX 5.24，DCloud 快速安心云打包。

结果：

- `apps/student-mobile` 能够作为 uni-app CLI 工程导入。
- HBuilderX 提供“运行到 Android App 基座”、云打包和本地打包入口。
- App 真机运行插件安装完成。
- `npm run build:app` 已生成 App 运行资源。
- 已取得项目正式 DCloud AppID `__UNI__1F755D6`，未提交账号凭据或签名密钥。
- 使用云端证书和快速安心模式免费生成 Android APK，打包过程未上传应用代码和证书。
- APK 大小约 14 MB，压缩结构完整；`jarsigner` 验证通过，签名算法为 SHA256withRSA，密钥长度 2048 位。
- APK SHA-256：`a35f74ffe227fa3f966227a7765b83291b02a4ffa26e6b0d59e8647fc66d84d3`。
- 本机未连接 Android 真机或模拟器，因此只把 APK 生成与签名记为通过，不把安装和原生业务流程记为通过。

### 真机登录问题与修复

- 首次 APK 真机实测在输入账号密码后长时间显示“正在登录”，随后提示网络连接失败。
- 原因是 `10.0.2.2` 只适用于 Android 模拟器，真机不能通过该地址访问电脑；同时旧请求没有显式超时和真机连接设置。
- 登录页已增加可持久化的“连接设置”，真机填写 API 启动日志输出的局域网地址。
- API 默认监听本机全部 IPv4 接口，启动时使用 Node.js 跨平台能力输出可供手机访问的地址。
- 登录前先检查健康状态，请求最长等待 10 秒；失败后恢复按钮并显示具体排查提示。

APK 生成后继续完成安装验证需要：

1. 连接 Android 真机或启动 Android 模拟器。
2. 安装桌面最新版本 `K12学习空间-Android-0.1.1.apk`。
3. 启动本地统一服务，在登录页填写终端输出的“手机访问地址”，完成登录、课件、作业提交、状态回写和退出。
4. 保存安装截图和关键页面截图。

工程识别截图：`docs/screenshots/android-hbuilderx-project.png`
