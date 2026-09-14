import { isValidStatus } from './validation.js';

function resolveTaskStatus({ status, completed }) {
  if (status !== undefined && status !== null && status !== '') {
    return isValidStatus(status) ? status : null;
  }

  if (typeof completed === 'boolean') {
    return completed ? 'completed' : 'pending';
  }

  return 'pending';
}

export { resolveTaskStatus };