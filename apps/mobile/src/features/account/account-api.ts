import { type DeleteAccountInput } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const accountApi = {
  /** Erases the account and all its data; confirmed with the password. */
  delete: (body: DeleteAccountInput) =>
    authorizedRequest<void>('/users/me', { method: 'DELETE', body }),
};
