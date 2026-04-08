import { GReply } from '../../lib/types/github';
import { GITHUB_GRAPHQL_API_URL } from '../config';

const ADD_DISCUSSION_REPLY_QUERY = `
  mutation($body: String!, $discussionId: ID!, $replyToId: ID!) {
    addDiscussionReply: addDiscussionComment(input: {body: $body, discussionId: $discussionId, replyToId: $replyToId}) {
      reply: comment {
        id
        viewerCanUpdate
        viewerCanDelete
        author {
          avatarUrl
          login
          url
          ... on User {
            name
          }
          ... on Organization {
            name
          }
        }
        viewerDidAuthor
        createdAt
        url
        authorAssociation
        lastEditedAt
        deletedAt
        isMinimized
        body
        bodyHTML
        reactionGroups {
          content
          users {
            totalCount
          }
          viewerHasReacted
        }
        userContentEdits(first: 20) {
          nodes {
            id
            editedAt
          }
        }
        replyTo {
          id
        }
      }
    }
  }`;

export interface AddDiscussionReplyBody {
  body: string;
  discussionId: string;
}

export interface AddDiscussionReplyResponse {
  data: {
    addDiscussionReply: {
      reply: GReply;
    };
  };
}

export async function addDiscussionReply(
  params: AddDiscussionReplyBody,
  token: string,
): Promise<AddDiscussionReplyResponse> {
  return fetch(GITHUB_GRAPHQL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: ADD_DISCUSSION_REPLY_QUERY,
      variables: params,
    }),
  }).then((r) => r.json());
}
