import ReactButtons from './ReactButtons';
import { IReply } from '../lib/types/adapter';
import { useCallback, useEffect, useRef, useState, CSSProperties } from 'react';
import { Reaction, updateCommentReaction } from '../lib/reactions';
import { handleCommentClick, processCommentBody } from '../lib/adapter';
import { useDateFormatter, useGiscusTranslation, useRelativeTimeFormatter } from '../lib/i18n';
import { deleteDiscussionComment } from '../services/github/deleteDiscussionComment';
import { updateDiscussionComment } from '../services/github/updateDiscussionComment';
import { useContext } from 'react';
import { AuthContext, DialogContext } from '../lib/context';

interface IReplyProps {
  reply: IReply;
  onReplyUpdate: (newReply: IReply, promise?: Promise<unknown>) => void;
}

export default function Reply({ reply, onReplyUpdate }: IReplyProps) {
  const { t } = useGiscusTranslation();
  const formatDate = useDateFormatter();
  const formatDateDistance = useRelativeTimeFormatter();
  const { token } = useContext(AuthContext);
  const { confirm } = useContext(DialogContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(reply.body);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const replyContainerRef = useRef<HTMLDivElement>(null);
  const editedDetailsRef = useRef<HTMLDetailsElement>(null);
  const editedSummaryRef = useRef<HTMLElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const updateReactions = useCallback(
    (content: Reaction, promise: Promise<unknown>) =>
      onReplyUpdate(updateCommentReaction(reply, content), promise),
    [reply, onReplyUpdate],
  );
  const authorName = reply.author.name || reply.author.login;
  const authorHandle =
    reply.author.name && reply.author.name !== reply.author.login ? `@${reply.author.login}` : null;
  const editDates = [...reply.editHistory]
    .filter((date) => !(reply.includesCreatedEdit && date === reply.createdAt))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  const handleDetailsToggle = () => {
    if (editedDetailsRef.current?.open && editedSummaryRef.current) {
      const rect = editedSummaryRef.current.getBoundingClientRect();
      setPopoverStyle({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  useEffect(() => {
    if (!isEditing) {
      setEditBody(reply.body);
    }
  }, [isEditing, reply.body]);

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

  const hidden = reply.deletedAt || reply.isMinimized;

  const handleEditSave = useCallback(async () => {
    if (!token || !editBody.trim() || editBody === reply.body) return;

    setIsSavingEdit(true);
    try {
      const response = await updateDiscussionComment(
        { commentId: reply.id, body: editBody },
        token,
      );
      const updatedReply = response.data?.updateDiscussionComment?.comment;
      if (!updatedReply) return;

      onReplyUpdate({
        ...reply,
        body: updatedReply.body,
        bodyHTML: updatedReply.bodyHTML,
        lastEditedAt: updatedReply.lastEditedAt,
        editHistory: updatedReply.userContentEdits?.nodes.map((edit) => edit.editedAt) ?? [],
        includesCreatedEdit:
          updatedReply.userContentEdits?.nodes.some((edit) => edit.editedAt === reply.createdAt) ??
          false,
      });
      setIsEditing(false);
    } finally {
      setIsSavingEdit(false);
    }
  }, [editBody, onReplyUpdate, reply, token]);

  const handleDelete = useCallback(async () => {
    if (!token) return;

    const shouldDelete = await confirm({
      message: t('confirmDeleteReply'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      scopeElement: replyContainerRef.current,
    });
    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const response = await deleteDiscussionComment({ id: reply.id }, token);
      const deletedReply = response.data?.deleteDiscussionComment?.comment;
      if (!deletedReply) return;

      onReplyUpdate({
        ...reply,
        deletedAt: deletedReply.deletedAt,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [confirm, onReplyUpdate, reply, t, token]);

  const handleEditCancel = useCallback(() => {
    setEditBody(reply.body);
    setIsEditing(false);
  }, [reply.body]);

  return (
    <div className="gsc-reply" ref={replyContainerRef}>
      <div className="gsc-tl-line" />
      <div className={`flex ${hidden ? 'items-center' : ''}`}>
        <div className="gsc-reply-author-avatar">
          <a
            rel="nofollow noopener noreferrer"
            target="_blank"
            href={reply.author.url}
            className="flex items-center"
          >
            <img
              className="rounded-full"
              src={reply.author.avatarUrl}
              width="30"
              height="30"
              alt={`${authorName} avatar`}
              loading="lazy"
            />
          </a>
        </div>
        <div className="w-full min-w-0 ml-2">
          {!hidden ? (
            <div className="gsc-reply-header">
              <div className="gsc-reply-author">
                <a
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  href={reply.author.url}
                  className="flex min-w-0 items-center"
                >
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
                  href={reply.url}
                  className="link-secondary overflow-hidden text-ellipsis"
                >
                  <time
                    className="whitespace-nowrap"
                    title={formatDate(reply.createdAt)}
                    dateTime={reply.createdAt}
                  >
                    {formatDateDistance(reply.createdAt)}
                  </time>
                </a>
                {reply.authorAssociation !== 'NONE' ? (
                  <div className="hidden text-xs leading-[18px] sm:inline-flex">
                    <span className="color-box-border-info font-medium capitalize rounded-xl border px-[7px]">
                      {t(reply.authorAssociation)}
                    </span>
                  </div>
                ) : null}
              </div>
              {reply.lastEditedAt ? (
                <details
                  className="gsc-edited-details"
                  ref={editedDetailsRef}
                  onToggle={handleDetailsToggle}
                >
                  <summary
                    ref={editedSummaryRef}
                    className="color-text-secondary gsc-reply-edited gsc-edited-summary"
                    title={t('lastEditedAt', { date: formatDate(reply.lastEditedAt) })}
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
                      {t('created')} {formatDate(reply.createdAt)}
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
            dir="auto"
            className={`markdown gsc-reply-content ${hidden ? ' not-shown' : ''}`}
            onClick={isEditing ? undefined : handleCommentClick}
            dangerouslySetInnerHTML={
              hidden || isEditing ? undefined : { __html: processCommentBody(reply.bodyHTML) }
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
                      disabled={isSavingEdit || !editBody.trim() || editBody === reply.body}
                    >
                      {t('save')}
                    </button>
                  </div>
                </div>
              </div>
            ) : hidden ? (
              <em className="color-text-secondary">
                {reply.deletedAt ? t('thisCommentWasDeleted') : t('thisCommentWasHidden')}
              </em>
            ) : null}
          </div>
          {!hidden ? (
            <div className="gsc-reply-footer">
              <div className="gsc-reply-reactions">
                <ReactButtons
                  reactionGroups={reply.reactions}
                  subjectId={reply.id}
                  onReact={updateReactions}
                  popoverPosition="top"
                />
              </div>
              {(reply.viewerCanUpdate || reply.viewerCanDelete) && !isEditing ? (
                <div className="flex items-center gap-2 text-xs">
                  {reply.viewerCanUpdate ? (
                    <button
                      type="button"
                      className="link-secondary"
                      onClick={() => setIsEditing(true)}
                    >
                      {t('edit')}
                    </button>
                  ) : null}
                  {reply.viewerCanDelete ? (
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
