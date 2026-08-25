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

环境：HBuilderX 5.24。

结果：

- `apps/student-mobile` 能够作为 uni-app CLI 工程导入。
- HBuilderX 提供“运行到 Android App 基座”、云打包和本地打包入口。
- App 真机运行插件安装完成。
- `npm run build:app` 已生成 App 运行资源。
- 云打包继续操作时要求 DCloud 账号登录；本机未配置 DCloud 凭据，也未连接 Android 真机或模拟器。
- 当前没有生成 APK，不记录安装和原生业务流程为通过。

继续完成 Android 安装验证需要：

1. 使用获授权的 DCloud 账号登录 HBuilderX。
2. 连接 Android 真机或启动 Android 模拟器。
3. 使用测试签名生成 APK，安装后完成登录、课件、作业提交、状态回写和退出。
4. 保存 APK、安装截图和关键页面截图。

工程识别截图：`docs/screenshots/android-hbuilderx-project.png`
