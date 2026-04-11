import { ArrowUpIcon, KebabHorizontalIcon } from '@primer/octicons-react';
import {
  CSSProperties,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { handleCommentClick, processCommentBody } from '../lib/adapter';
import { IComment, IReply } from '../lib/types/adapter';
import { Reaction, updateCommentReaction } from '../lib/reactions';
import { deleteDiscussionComment } from '../services/github/deleteDiscussionComment';
import { toggleUpvote } from '../services/github/toggleUpvote';
import { updateDiscussionComment } from '../services/github/updateDiscussionComment';
import CommentBox from './CommentBox';
import ReactButtons from './ReactButtons';
import Reply from './Reply';
import { AuthContext, DialogContext } from '../lib/context';
import { useDateFormatter, useGiscusTranslation, useRelativeTimeFormatter } from '../lib/i18n';

interface ICommentProps {
  children?: ReactNode;
  comment: IComment;
  replyBox?: ReactElement<typeof CommentBox>;
  onCommentUpdate?: (newComment: IComment, promise?: Promise<unknown>) => void;
  onReplyUpdate?: (newReply: IReply, promise?: Promise<unknown>) => void;
}

export default function Comment({
  children,
  comment,
  replyBox,
  onCommentUpdate,
  onReplyUpdate,
}: ICommentProps) {
  const { t, dir } = useGiscusTranslation();
  const formatDate = useDateFormatter();
  const formatDateDistance = useRelativeTimeFormatter();
  const [backPage, setBackPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const commentCardRef = useRef<HTMLDivElement>(null);
  const editedDetailsRef = useRef<HTMLDetailsElement>(null);
  const editedSummaryRef = useRef<HTMLElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const replies = comment.replies.slice(-5 - backPage * 50);
  const remainingReplies = comment.replyCount - replies.length;

  const hasNextPage = replies.length < comment.replies.length;
  const hasUnfetchedReplies = !hasNextPage && remainingReplies > 0;

  const { token } = useContext(AuthContext);
  const { confirm } = useContext(DialogContext);
  const authorName = comment.author.name || comment.author.login;
  const authorHandle =
    comment.author.name && comment.author.name !== comment.author.login
      ? `@${comment.author.login}`
      : null;
  const editDates = [...comment.editHistory]
    .filter((date) => !(comment.includesCreatedEdit && date === comment.createdAt))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  const updateReactions = useCallback(
    (reaction: Reaction, promise: Promise<unknown>) =>
      onCommentUpdate(updateCommentReaction(comment, reaction), promise),
    [comment, onCommentUpdate],
  );

  useEffect(() => {
    if (!isEditing) {
      setEditBody(comment.body);
    }
  }, [comment.body, isEditing]);

  useEffect(() => {
    const closeDetails = () => {
      if (editedDetailsRef.current?.open) {
        editedDetailsRef.current.open = false;
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const details = editedDetailsRef.current;
      if (!details?.open) return;
      if (event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('blur', closeDetails);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('blur', closeDetails);
    };
  }, []);

  const handleDetailsToggle = () => {
    if (editedDetailsRef.current?.open && editedSummaryRef.current) {
      const rect = editedSummaryRef.current.getBoundingClientRect();
      setPopoverStyle({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  const incrementBackPage = () => setBackPage(backPage + 1);

  const upvote = useCallback(() => {
    const upvoteCount = comment.viewerHasUpvoted
      ? comment.upvoteCount - 1
      : comment.upvoteCount + 1;

    const promise = toggleUpvote(
      { upvoteInput: { subjectId: comment.id } },
      token,
      comment.viewerHasUpvoted,
    );

    onCommentUpdate(
      {
        ...comment,
        upvoteCount,
        viewerHasUpvoted: !comment.viewerHasUpvoted,
      },
      promise,
    );
  }, [comment, onCommentUpdate, token]);

  const hidden = !!comment.deletedAt || comment.isMinimized;

  const handleEditSave = useCallback(async () => {
    if (!token || !onCommentUpdate || !editBody.trim() || editBody === comment.body) return;

    setIsSavingEdit(true);
    try {
      const response = await updateDiscussionComment(
        { commentId: comment.id, body: editBody },
        token,
      );
      const updatedComment = response.data?.updateDiscussionComment?.comment;
      if (!updatedComment) return;

      onCommentUpdate({
        ...comment,
        body: updatedComment.body,
        bodyHTML: updatedComment.bodyHTML,
        lastEditedAt: updatedComment.lastEditedAt,
        editHistory: updatedComment.userContentEdits?.nodes.map((edit) => edit.editedAt) ?? [],
        includesCreatedEdit:
          updatedComment.userContentEdits?.nodes.some(
            (edit) => edit.editedAt === comment.createdAt,
          ) ?? false,
      });
      setIsEditing(false);
    } finally {
      setIsSavingEdit(false);
    }
  }, [comment, editBody, onCommentUpdate, token]);

  const handleEditCancel = useCallback(() => {
    setEditBody(comment.body);
    setIsEditing(false);
  }, [comment.body]);

  const handleDelete = useCallback(async () => {
    if (!token || !onCommentUpdate) return;

    const shouldDelete = await confirm({
      message: t('confirmDeleteComment'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      scopeElement: commentCardRef.current,
    });
    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const response = await deleteDiscussionComment({ id: comment.id }, token);
      const deletedComment = response.data?.deleteDiscussionComment?.comment;
      if (!deletedComment) return;

      onCommentUpdate({
        ...comment,
        deletedAt: deletedComment.deletedAt,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [comment, confirm, onCommentUpdate, t, token]);

  return (
    <div className="gsc-comment">
      <div
        ref={commentCardRef}
        className={`color-bg-primary w-full min-w-0 rounded-md border ${
          comment.viewerDidAuthor ? 'color-box-border-info' : 'color-border-primary'
        }`}
      >
        {!comment.isMinimized ? (
          <div className="gsc-comment-header">
            <div className="gsc-comment-author">
              <a
                rel="nofollow noopener noreferrer"
                target="_blank"
                href={comment.author.url}
                className="gsc-comment-author-avatar"
              >
                <img
                  className="mr-2 rounded-full"
                  src={comment.author.avatarUrl}
                  width="30"
                  height="30"
                  alt={`${authorName} avatar`}
                  loading="lazy"
                />
                <span className="link-primary overflow-hidden text-ellipsis font-semibold">
                  {authorName}
                </span>
                {authorHandle ? (
                  <span className="color-text-secondary ml-1 text-xs">{authorHandle}</span>
                ) : null}
              </a>
              <a
                rel="nofollow noopener noreferrer"
                target="_blank"
                href={comment.url}
                className="link-secondary overflow-hidden text-ellipsis"
              >
                <time
                  className="whitespace-nowrap"
                  title={formatDate(comment.createdAt)}
                  dateTime={comment.createdAt}
                >
                  {formatDateDistance(comment.createdAt)}
                </time>
              </a>
              {comment.authorAssociation !== 'NONE' ? (
                <div className="hidden text-xs leading-[18px] sm:inline-flex">
                  <span className="color-box-border-info font-medium capitalize ml-1 rounded-xl border px-[7px]">
                    {t(comment.authorAssociation)}
                  </span>
                </div>
              ) : null}
            </div>
            {comment.lastEditedAt ? (
              <details
                className="gsc-edited-details"
                ref={editedDetailsRef}
                onToggle={handleDetailsToggle}
              >
                <summary
                  ref={editedSummaryRef}
                  className="color-text-secondary gsc-comment-edited gsc-edited-summary"
                  title={t('lastEditedAt', { date: formatDate(comment.lastEditedAt) })}
                >
                  {t('edited')}
                </summary>
                <div
                  className="color-bg-primary color-border-primary gsc-edited-popover"
                  style={popoverStyle}
                >
                  <p className="gsc-edited-popover-header">
                    {t('editCount', { count: editDates.length })}
                  </p>
                  {editDates.map((date) => (
                    <p key={date} className="gsc-edited-popover-line">
                      {formatDate(date)}
                    </p>
                  ))}
                  <p className="gsc-edited-popover-line gsc-edited-popover-created">
                    {t('created')} {formatDate(comment.createdAt)}
                  </p>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
        {/*
          The <div> element *might* have a child <button> element from
          GitHub's markdown renderer result that allows keyboard interaction.
        */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div
          dir={children ? dir : 'auto'}
          className={`markdown gsc-comment-content${
            comment.isMinimized ? ' minimized color-bg-tertiary border-color-primary' : ''
          }`}
          onClick={isEditing ? undefined : handleCommentClick}
          dangerouslySetInnerHTML={
            hidden || isEditing ? undefined : { __html: processCommentBody(comment.bodyHTML) }
          }
        >
          {isEditing ? (
            <div className="gsc-comment-box-main m-0">
              <div className="gsc-comment-box-write">
                <textarea
                  dir="auto"
                  className="gsc-comment-box-textarea"
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  disabled={isSavingEdit}
                />
                <div className="gsc-comment-box-textarea-extras" />
              </div>
              <div className="gsc-comment-box-bottom m-0 mt-2">
                <div className="gsc-comment-box-buttons">
                  <button
                    type="button"
                    className="btn mr-2"
                    onClick={handleEditCancel}
                    disabled={isSavingEdit}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleEditSave}
                    disabled={isSavingEdit || !editBody.trim() || editBody === comment.body}
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </div>
          ) : hidden ? (
            <em className="color-text-secondary">
              {comment.deletedAt ? t('thisCommentWasDeleted') : t('thisCommentWasMinimized')}
            </em>
          ) : null}
        </div>
        {children}
        {!comment.isMinimized && onCommentUpdate ? (
          <div className="gsc-comment-footer">
            <div className="gsc-comment-reactions">
              <button
                type="button"
                className={`gsc-upvote-button gsc-social-reaction-summary-item ${
                  comment.viewerHasUpvoted ? 'has-reacted' : ''
                }`}
                onClick={upvote}
                // TODO: Remove `true ||` when GitHub allows upvote with app-issued user tokens
                // https://github.com/orgs/community/discussions/3968
                disabled={true || !token || !comment.viewerCanUpvote}
                aria-label={token ? t('upvote') : t('youMustBeSignedInToUpvote')}
                title={
                  token
                    ? t('upvotes', { count: comment.upvoteCount })
                    : t('youMustBeSignedInToUpvote')
                }
              >
                <ArrowUpIcon className="gsc-direct-reaction-button-emoji" />

                <span
                  className="gsc-social-reaction-summary-item-count"
                  title={t('upvotes', { count: comment.upvoteCount })}
                >
                  {comment.upvoteCount}
                </span>
              </button>
              {!hidden ? (
                <ReactButtons
                  reactionGroups={comment.reactions}
                  subjectId={comment.id}
                  onReact={updateReactions}
                  popoverPosition="top"
                />
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {(comment.viewerCanUpdate || comment.viewerCanDelete) && !isEditing ? (
                <div className="flex items-center gap-2 text-xs">
                  {comment.viewerCanUpdate ? (
                    <button
                      type="button"
                      className="link-secondary"
                      onClick={() => setIsEditing(true)}
                    >
                      {t('edit')}
                    </button>
                  ) : null}
                  {comment.viewerCanDelete ? (
                    <button
                      type="button"
                      className="link-secondary"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {t('delete')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="gsc-comment-replies-count">
                <span className="color-text-tertiary text-xs">
                  {t('replies', { count: comment.replyCount, plus: '' })}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {comment.replies.length > 0 ? (
          <div
            className={`color-bg-inset color-border-primary gsc-replies ${
              !replyBox || hidden ? 'rounded-b-md' : ''
            }`}
          >
            {hasNextPage || hasUnfetchedReplies ? (
              <div className="flex h-8 items-center mb-2 pl-4">
                <div className="flex w-[29px] shrink-0 content-center mr-[9px]">
                  <KebabHorizontalIcon className="w-full rotate-90 fill-[var(--color-border-muted)]" />
                </div>

                {hasNextPage ? (
                  <button className="color-text-link underline" onClick={incrementBackPage}>
                    {t('showPreviousReplies', { count: remainingReplies })}
                  </button>
                ) : null}

                {hasUnfetchedReplies ? (
                  <a
                    href={comment.url}
                    className="color-text-link underline"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                  >
                    {t('seePreviousRepliesOnGitHub', { count: remainingReplies })}
                  </a>
                ) : null}
              </div>
            ) : null}

            {onReplyUpdate
              ? replies.map((reply) => (
                  <Reply key={reply.id} reply={reply} onReplyUpdate={onReplyUpdate} />
                ))
              : null}
          </div>
        ) : null}

        {!comment.isMinimized && !!replyBox ? replyBox : null}
      </div>
    </div>
  );
}
