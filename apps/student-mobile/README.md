# 学生移动端

本工作区使用 uni-app、Vue 3 和 TypeScript，共用一套源码构建 Android APP 与微信小程序。业务数据来自统一服务，登录仅允许学生角色。

## 构建

在项目根目录执行：

```text
npm ci
npm run build:app
npm run build:mp-weixin
```

构建目录：

- Android APP 资源：`apps/student-mobile/dist/build/app/`
- 微信小程序：`apps/student-mobile/dist/build/mp-weixin/`

APP 资源需导入 HBuilderX 运行或生成 Android 测试安装包。微信小程序目录可直接导入微信开发者工具。

## 本地服务地址

- Android 模拟器默认访问 `http://10.0.2.2:3000`。
- 微信开发者工具默认访问 `http://127.0.0.1:3000`，本地联调时关闭合法域名校验。
- 其他环境通过 `VITE_API_BASE_URL` 注入，不在源码中写设备相关绝对路径。

需要 `.env` 时，两种系统分别执行：

macOS：

```bash
cp apps/student-mobile/.env.example apps/student-mobile/.env
```

Windows PowerShell：

```powershell
Copy-Item apps/student-mobile/.env.example apps/student-mobile/.env
```

`.env` 不提交到仓库。

## 端侧验证

- APP：在 Android 模拟器或真机登录 `student_101`，查看课件、作业、批改和考勤，完成附件提交并退出。
- 小程序：导入 `dist/build/mp-weixin/`，用同一账号重复上述流程。
- 本地测试密码见项目根目录 `docs/demo-accounts.md`。
