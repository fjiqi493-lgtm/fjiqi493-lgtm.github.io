# 极简高级工业设计作品集（GitHub Pages 版）

纯静态站点，数据存于本仓库的 `site.json`，后台通过 GitHub Token 把修改提交回仓库。
访客只读；管理员登录后可改文案、上传图片、增删作品。改完约 10–60 秒自动同步到前台。

## 线上地址
- 前台：https://fjiqi493-lgtm.github.io/
- 后台：https://fjiqi493-lgtm.github.io/admin.html

## 访客（任何人）
打开前台链接即可浏览全部作品；手机 / 电脑都正常显示（响应式）。不能上传、不能修改、不能删除。

## 管理员入口
1. 打开 `https://fjiqi493-lgtm.github.io/admin.html`（页面右上角「管理」也可进）。
2. 输入你的 **GitHub Token** 登录。
   - 本方案没有后端服务器，「管理员密码」就是你的 GitHub Token。
   - Token 需有本仓库的 **repo 写权限**。
   - Token 只存在你自己的浏览器 localStorage，不会上传给任何人。
3. 登录后可：编辑首页 / 关于 / 联系内容、管理作品（新建 / 编辑 / 删除 / 拖拽上传图片 / 设封面）。
4. 每次保存 = 一次 git 提交；GitHub Pages 重新部署后，所有人看到最新内容。

## 管理员 Token 在哪里改 / 怎么更稳妥
- Token 由你在 GitHub 生成，不在代码里：
  GitHub → 右上角头像 → **Settings → Developer settings → Personal access tokens**
  - 推荐用 **Fine-grained token**，只授权这一个仓库的 `Contents: Read and write`，更安全。
  - 或经典 token（classic），勾选 `repo` 权限。
- 想换 Token：在后台点「退出登录」，再用新 Token 登录即可。
- 安全建议：本仓库是公开仓库，**不要把私密信息写进 `site.json`**；Token 用完可在 GitHub 撤销。

## 本地预览
```bash
cd gh-pages
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000/
```

## 重新部署 / 更新代码
本目录即仓库内容。改完代码后：
```bash
git add -A
git commit -m "更新"
git push
```
GitHub Pages 会自动重新部署。

## 目录结构
```
index.html      首页（头像 + 简介 + 精选作品）
works.html      作品列表
work.html       作品详情（大图 + 描述 + 参数，点击放大）
admin.html      后台管理（需 GitHub Token）
site.json       全部站点数据（作品、关于、联系…）
assets/         初始作品图
uploads/        后台上传的图片（提交进仓库）
css/style.css   浅色极简样式
js/api.js       数据层（读 site.json / 写 GitHub 仓库）
js/admin.js     后台逻辑
js/home.js / works.js / work.js   前台渲染
```
