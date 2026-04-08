import { GITHUB_GRAPHQL_API_URL } from '../config';

const UPDATE_DISCUSSION_COMMENT_QUERY = `
  mutation($commentId: ID!, $body: String!) {
    updateDiscussionComment(input: {commentId: $commentId, body: $body}) {
      comment {
        id
        lastEditedAt
        body
        bodyHTML
        userContentEdits(first: 20) {
          nodes {
            id
            editedAt
          }
        }
      }
    }
  }`;

export interface UpdateDiscussionCommentBody {
  commentId: string;
  body: string;
}

export interface UpdateDiscussionCommentResponse {
  data: {
    updateDiscussionComment: {
      comment: {
        id: string;
        lastEditedAt: string;
        body: string;
        bodyHTML: string;
        userContentEdits?: {
          nodes: Array<{ id: string; editedAt: string }>;
        };
      };
    };
  };
}

export async function updateDiscussionComment(
  params: UpdateDiscussionCommentBody,
  token: string,
): Promise<UpdateDiscussionCommentResponse> {
  return fetch(GITHUB_GRAPHQL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: UPDATE_DISCUSSION_COMMENT_QUERY,
      variables: params,
    }),
  }).then((r) => r.json());
}
