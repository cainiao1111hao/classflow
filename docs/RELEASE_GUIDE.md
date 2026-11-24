# 在 GitHub 发布课序 ClassFlow

先创建公开源码仓库，再用 Release 提供下载，最后在 GitHub Discussions 发布介绍并收集反馈。若学院指定其他论坛，在指定版块发帖并附上 GitHub 仓库和 Release 链接。各步骤实际完成后再记录链接。

## 1. 发布前验收

- [ ] 阅读 `README.md`，自己能解释程序的主要功能和本地存储方式。
- [ ] 从空白状态添加、修改、完成和删除任务。
- [ ] 用不同课程、不同截止日期和优先级验证搜索、筛选与排序。
- [ ] 完成一次专注计时，确认本次记录已计入统计。
- [ ] 刷新后数据仍存在；如直接打开文件无法保存，改用本地服务器验证。
- [ ] 导出 JSON，修改页面数据，再导入恢复；确认导入前有覆盖提示。
- [ ] 错误或不支持的备份会提示失败，当前数据仍保留。
- [ ] 打开 CSV，检查中文、换行和引号是否正常。
- [ ] 检查窄屏布局与键盘操作。
- [ ] 使用 Node.js 22 或更高版本运行 `npm test`，保存执行结果。
- [ ] 确认源码不包含个人备份、姓名、账号凭证、访问令牌或私人路径。

发布的是软件源码。不要把 `localStorage` 中的真实任务或自己的备份文件随源码上传。

## 2. 发布公开源码

[新建 GitHub 仓库](https://github.com/new)，所有者选自己的 GitHub 账号，名称填 `classflow`，可见性选 **Public**。本地项目已包含 README、`.gitignore` 和 MIT 许可证，创建仓库时保持这些初始化选项关闭。参见 [GitHub 新建仓库说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)。

仓库简介可用以下文字。

```text
课序 ClassFlow：离线课程任务助手，含截止日期、番茄钟、学习统计与数据备份。零运行依赖，MIT 开源。
```

### 方式 A：使用 Git

适合已安装 Git 并完成 GitHub 登录或凭证配置的情况。

在项目目录检查状态。

```text
git status
```

如果提示当前目录尚未初始化为仓库，执行以下命令。

```text
git init -b main
```

检查待提交文件，确认没有个人数据或凭证，再创建提交。

```text
git add .
git status
git commit -m "发布课序 ClassFlow 1.0.0 初始源码"
```

如果项目已经有初始提交，直接检查现有远程仓库。

```text
git remote -v
```

没有远程仓库时，把下面的 `YOUR_NAME` 换成自己的 GitHub 用户名，再执行命令。

```text
git remote add origin https://github.com/YOUR_NAME/classflow.git
```

若已经存在 `origin`，先确认它指向新建的仓库。确认分支为 `main` 后执行推送。

```text
git push -u origin main
```

若 GitHub 要求登录，按页面提示操作。

### 方式 B：通过平台上传

在仓库页面选择 **Add file → Upload files**，上传项目文件。保留目录结构，确认 `LICENSE`、`README.md`、`tests/`、`docs/` 和 `.github/` 都已提交。

后续维护仍建议学习 Git，便于记录每次真实变更。

## 3. 创建首个版本

1. 在仓库的 **Releases** 页面选择 **Draft a new release**，创建 `v1.0.0` 标签，目标选包含首版源码的 `main`。
2. 标题填写 `课序 ClassFlow v1.0.0`，从 `CHANGELOG.md` 提取已实现功能和使用限制。
3. 如需提供免解压的下载，先运行 `npm run build`，双击生成的 `dist/classflow.html` 确认能运行，再将文件附到此次 Release。GitHub 也会为标签提供源码 ZIP。
4. 选择 **Publish release**。用未登录窗口打开仓库和 Release，下载公开附件或源码 ZIP 并运行。保存 Release 链接。参见 [GitHub 发布版本说明](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)。

不要把草稿链接、仅自己可见的地址或本地 `E:\` 路径当作公开下载链接。

## 4. 在 GitHub Discussions 发帖

1. 在仓库 **Settings → General → Features** 中启用 **Discussions**。如果界面打开欢迎帖表单，可以用发布文案创建首帖。参见 [GitHub Discussions 快速入门](https://docs.github.com/en/discussions/quickstart)。
2. 在 **Discussions** 中选择 **New discussion**，类别选 **Announcements**（或仓库中用于发布公告的类别）。复制 [论坛帖子草稿](FORUM_POST.md) 的标题和正文，将占位符换成仓库、Release 和 Issues 的真实链接。添加使用示例数据截取的软件界面。
3. 发布后用未登录窗口确认帖子公开可读。保存帖子永久链接、截图、时间和对应版本链接，供 SPEC 汇报核对。
4. 若学院指定论坛，在指定论坛的合适版块发布同一版本介绍，并保存审核通过后的帖子链接。


## 5. 开始持续维护

参考 [四周维护计划](MAINTENANCE.md)，每周检查 Issues 和讨论帖。记录处理的问题、代码提交和验证结果。没有反馈时，可以检查兼容性、文档或边界条件并记录结果。

发布后有实际改动时，更新 `CHANGELOG.md`，创建对应 Release，再到原帖补充变更和版本链接。

## 提交学院的成果清单

| 成果 | 应提供的真实证据 |
| --- | --- |
| 可运行的软件 | 公开版本下载地址与实际演示 |
| 开源源码 | 公开仓库、MIT 许可证、提交记录 |
| 论坛发布 | 公开帖子永久链接与截图 |
| 持续维护 | Issue/反馈、修复提交、测试结果、版本与更新日志 |
| 自己的理解 | 功能演示、核心原理说明、AI 使用说明 |

如果老师要求特定论坛、维护次数、周期或署名格式，以学院的具体要求为准。
