# 部署到 GitHub Pages

这是完整静态网站，已包含八类完整视频、未来一秒 UAV 动作预测、目标预测、360° 交互及高清论文图片。无需安装 Node.js、训练环境或 GPU；发布后不依赖本地预览服务或 WAM。

## 1. 解压并创建仓库

解压 `360UAV-ETrack-GitHub-Pages.zip`。进入解压后的文件夹，里面应直接看到 `index.html`、`assets/`、`.github/`。

在 GitHub 创建一个空的 **Public** 仓库，例如 `360UAV-ETrack`。建议不要在创建时自动添加 README，以便按下面步骤上传。

**上传的是解压后的文件和文件夹，不是这个 ZIP。** `index.html` 和 `.github/` 必须放在仓库根目录，不能在它们外面再套一层同名目录。

## 2. 上传文件（推荐 GitHub Desktop）

本包的视频大于 GitHub 网页上传的 25 MiB 限制，请用 GitHub Desktop 或 Git push。每个文件均小于普通 Git 的 100 MiB 限制，无需 Git LFS。

### GitHub Desktop

1. 用 GitHub Desktop 克隆上面创建的空仓库。
2. 将解压目录中的全部内容复制到克隆目录，**包括隐藏的 `.github`、`.gitignore`、`.gitattributes` 和 `.nojekyll`**。
3. Commit 后点击 **Push origin**。若尚未发布仓库，使用 **Publish repository** 并取消私有仓库选项。

### 或使用命令行

在解压目录打开终端，执行（把 URL 替换成你自己的仓库）：

```bash
git init
git add .
git commit -m "Publish 360UAV-ETrack project website"
git branch -M 360UAV-ETrack_360UAV-TVLA_PAGE
git remote add origin https://github.com/LiBingyu01/360UAV-ETrack_360UAV-TVLA.git
git push -u origin 360UAV-ETrack_360UAV-TVLA_PAGE
```

请不要对 MP4 启用 Git LFS；本包按普通 Git 文件部署。

## 3. 启用 Pages

进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。

然后进入 **Actions → Deploy project website to GitHub Pages → Run workflow**，选择 `360UAV-ETrack_360UAV-TVLA_PAGE` 分支。设置好 Pages 后，后续每次 push 到 `360UAV-ETrack_360UAV-TVLA_PAGE` 都会自动更新网站。

如果第一次 push 时尚未选择 Pages 的 GitHub Actions，首次部署可能失败；完成上述设置后重新运行该 workflow 即可。

部署成功后，Actions 的 `github-pages` 环境会显示真实网站 URL。一般形式为：

```text
https://libingyu01.github.io/360UAV-ETrack_360UAV-TVLA/
```

如果仓库名字不同，URL 最后一段也会不同。站点使用相对路径，无需修改 JS 或图片路径。不要在 GitHub Pages 的 Custom domain 中填写上述默认网址；自定义域名可按需要另外设置。

## 本地预览及修改

```bash
python serve.py
```

打开 `http://127.0.0.1:8771/`。`serve.py` 仅用于本地预览，线上 Pages 直接提供静态文件。

- `index.html`：文字、论文链接、作者及各页面区块。
- `styles.css`：布局、图例和按钮闪烁。
- `app.js`：任务切换与结果表。
- `sphere.js`：360° 视频及默认视角。
- `trajectories.js`：同步轨迹图。
- `assets/`：全部网站媒体及数据。

本地检查及打包部署目录：

```bash
python tools/check_site.py
python tools/build_site.py
```

`_site/` 为 Actions 上传的纯静态目录；不要把它提交到 Git。

## 容量与可复现信息

本包已检查普通 Git 的单文件 100 MiB 和 Pages 的站点 1 GB 限制。全长视频占主要容量，请避免将不同历史版本反复加入仓库；此包只包含当前展示版本。检查结果见 `PACKAGE_CHECK.json`。

图例中蓝色为未来一秒的 UAV 动作预测，绿色为目标真值，粉色为目标预测。视频为专家观测 replay；蓝色动作路径由原生十步 XYZ 速度积分，显示时固定下移，原始数值不变。详细来源和验证见 `assets/provenance/README.md`。

本包已准备好部署配置，但尚未替你上传或公开发布。没有预设 GitHub 账号、仓库地址或自定义域名；无需在打包脚本中输入密钥。

官方说明：
- https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
