import { readFileSync } from 'fs';
import { join } from 'path';
import Head from 'next/head';
import Script from 'next/script';
import { ComponentProps, useContext, useEffect, useState } from 'react';
import Comment from '../components/Comment';
import { Reactions } from '../lib/reactions';
import { IComment, IReactionGroups } from '../lib/types/adapter';
import { renderMarkdown } from '../services/github/markdown';
import { getAppAccessToken } from '../services/github/getAppAccessToken';
import { useDebounce } from '../lib/hooks';
import Configuration from '../components/Configuration';
import { ThemeContext } from '../lib/context';
import { sendData } from '../lib/messages';
import { ISetConfigMessage } from '../lib/types/giscus';
import { getThemeUrl } from '../lib/utils';
import { GetStaticPropsContext, InferGetStaticPropsType } from 'next';
import Router from 'next/router';
import getT from 'next-translate/getT';
import { AvailableLanguage } from '../lib/i18n';
import { env, meta } from '../lib/variables';
import fallbacks from '../i18n.fallbacks.json';

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  const authorRepoWithOwner = 'marc-santos/giscus';
  const fallbackCreatedAt = '2026-04-05T21:10:00+10:00';
  const fallbackCommitUrl = `https://github.com/${authorRepoWithOwner}`;
  const localeSuffix = locale === 'en' ? '' : `.${fallbacks[locale] ?? locale}`;
  const t = await getT(locale, 'config');

  const path = join(process.cwd(), `README${localeSuffix}.md`);
  const readme = readFileSync(path, 'utf-8');
  const contents = readme.split('<!-- configuration -->');
  const [afterConfig] = contents[1].split('<!-- end -->');

  contents[1] = `${afterConfig}\n## ${t('tryItOut')} 👇👇👇\n`;

  const latestCommitDatePromise = fetch(
    `https://api.github.com/repos/${authorRepoWithOwner}/commits?per_page=1`,
  )
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch latest commit: ${response.status}`);
      return response.json() as Promise<
        Array<{ commit?: { committer?: { date?: string } }; html_url?: string }>
      >;
    })
    .then((commits) => ({
      createdAt: commits[0]?.commit?.committer?.date || fallbackCreatedAt,
      commitUrl: commits[0]?.html_url || fallbackCommitUrl,
    }))
    .catch(() => ({ createdAt: fallbackCreatedAt, commitUrl: fallbackCommitUrl }));

  const token = await getAppAccessToken(env.demo_repo).catch(() => '');
  const [contentBefore, contentAfter] = await Promise.all(
    contents.map((section) => renderMarkdown(section, token, env.demo_repo)),
  );
  const latestCommitData = await latestCommitDatePromise;

  const comment: IComment = {
    author: {
      avatarUrl: 'https://avatars.githubusercontent.com/u/43739539?v=4',
      login: 'marc-santos',
      name: 'Marc Santos',
      url: 'https://github.com/marc-santos',
    },
    authorAssociation: 'APP',
    bodyHTML: contentBefore,
    createdAt: latestCommitData.createdAt,
    deletedAt: null,
    id: 'onboarding',
    body: '',
    isMinimized: false,
    editHistory: [],
    includesCreatedEdit: false,
    lastEditedAt: null,
    reactions: Object.keys(Reactions).reduce((prev, key) => {
      prev[key] = { count: 0, viewerHasReacted: false };
      return prev;
    }, {}) as IReactionGroups,
    replies: [],
    replyCount: 0,
    upvoteCount: 0,
    url: latestCommitData.commitUrl,
    viewerCanDelete: false,
    viewerDidAuthor: false,
    viewerCanUpdate: false,
    viewerHasUpvoted: false,
    viewerCanUpvote: false,
  };

  return {
    props: {
      comment,
      contentAfter,
      locale: locale as AvailableLanguage,
    },
  };
}

type DirectConfig = ComponentProps<typeof Configuration>['directConfig'];
type DirectConfigHandler = ComponentProps<typeof Configuration>['onDirectConfigChange'];

export default function Home({
  comment,
  contentAfter,
  locale,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { theme, setTheme } = useContext(ThemeContext);
  const [directConfig, setDirectConfig] = useState<DirectConfig>({
    theme: 'preferred_color_scheme',
    themeUrl: `${env.app_host}/themes/custom_example.css`,
    reactionsEnabled: true,
    showBranding: true,
    emitMetadata: false,
    lang: locale,
    inputPosition: 'bottom',
  });
  const themeUrl = useDebounce(directConfig.themeUrl);
  const configTheme = getThemeUrl(directConfig.theme, themeUrl);

  const handleDirectConfigChange: DirectConfigHandler = (key, value) =>
    setDirectConfig({ ...directConfig, [key]: value });

  useEffect(() => {
    setTheme(configTheme);
  }, [setTheme, configTheme]);

  useEffect(() => {
    const data: ISetConfigMessage = {
      setConfig: {
        theme: configTheme,
        reactionsEnabled: directConfig.reactionsEnabled,
        showBranding: directConfig.showBranding,
        emitMetadata: directConfig.emitMetadata,
        inputPosition: directConfig.inputPosition,
        lang: directConfig.lang,
      },
    };
    sendData(data, location.origin);
  }, [
    directConfig.emitMetadata,
    directConfig.reactionsEnabled,
    directConfig.showBranding,
    directConfig.inputPosition,
    directConfig.lang,
    configTheme,
    themeUrl,
  ]);

  useEffect(() => {
    Router.replace(Router.asPath, Router.pathname, {
      locale: directConfig.lang,
      scroll: false,
    });
  }, [directConfig.lang]);

  return (
    <main className="gsc-homepage-bg min-h-screen w-full" data-theme={theme}>
      <Head>
        <title>Giscussions</title>
        <meta name="giscus:backlink" content={env.app_host} />
        <meta name="description" content={meta.description} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:image" content={meta.image} />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@laymonage" />
      </Head>
      <div className="color-text-primary w-full max-w-3xl mx-auto p-2">
        <Comment comment={comment}>
          <Configuration
            directConfig={directConfig}
            onDirectConfigChange={handleDirectConfigChange}
          />
          <div className="markdown p-4 pt-0" dangerouslySetInnerHTML={{ __html: contentAfter }} />
        </Comment>

        <div id="comments" className="giscus w-full my-8" />
        {env.demo_repo && env.demo_repo_id && env.demo_category_id ? (
          <Script
            src="/client.js"
            data-repo={env.demo_repo}
            data-repo-id={env.demo_repo_id}
            data-category-id={env.demo_category_id}
            data-mapping="specific"
            data-term="Welcome to Giscussions!"
            data-theme="preferred_color_scheme"
            data-reactions-enabled="1"
            data-show-branding="1"
            data-emit-metadata="0"
            data-input-position="bottom"
            data-lang={locale}
            data-strict="1"
          />
        ) : null}
      </div>
    </main>
  );
}
