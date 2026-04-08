import { GITHUB_GRAPHQL_API_URL } from '../config';

const DELETE_DISCUSSION_COMMENT_QUERY = `
  mutation($id: ID!) {
    deleteDiscussionComment(input: {id: $id}) {
      comment {
        id
        deletedAt
      }
    }
  }`;

export interface DeleteDiscussionCommentBody {
  id: string;
}

export interface DeleteDiscussionCommentResponse {
  data: {
    deleteDiscussionComment: {
      comment: {
        id: string;
        deletedAt: string;
      };
    };
  };
}

export async function deleteDiscussionComment(
  params: DeleteDiscussionCommentBody,
  token: string,
): Promise<DeleteDiscussionCommentResponse> {
  return fetch(GITHUB_GRAPHQL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: DELETE_DISCUSSION_COMMENT_QUERY,
      variables: params,
    }),
  }).then((r) => r.json());
}
