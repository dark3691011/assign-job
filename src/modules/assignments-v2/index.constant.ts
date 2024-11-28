export const USER_QUEUE = `queue:users`;
export const TASK_QUEUE = `queue:tasks`;
export const BULL_QUEUE_NAME = `taskQueue`;
export const RETRY_USER_COUNT = `retry:user:`;
export const RETRY_TASK_COUNT = `retry:task:`;
export const DARK_LIST_QUEUE_TASK = `dlq:tasks`;
export const DARK_LIST_QUEUE_USER = `dlq:users`;
export const EXPIRED_RETRY_COUNT = 10 * 60; // 6 mins

export enum TYPE_QUEUE_ENUM {
  USER = `User`,
  TASK = `Task`,
}

export const ERROR_USER_ERROR = `USER_ERROR`;
export const ERROR_TASK_ERROR = `TASK_ERROR`;

export const RE_ADD_QUEUE_TASK = [ERROR_USER_ERROR];

export const RE_ADD_QUEUE_USER = [ERROR_TASK_ERROR];
