/**
 * 区分「基础设施坏了」和「实现没写对」。
 *
 * 夜里最贵的一种浪费：网关 502 / 连接被拒 / 子进程被信号打死，被当成"实现失败"，
 * 于是烧掉一次尝试额度，还让人以为代码有问题。基础设施错误不该烧 attempts，
 * 也不该被读成判决——它只说明"这一轮没跑起来"。
 */

export type ErrorClass = "infra" | "impl";

export const INFRA_TAG = "[infra]";

/** 强 infra 信号：网络层/服务端/资源耗尽。见到就基本不是代码的问题。 */
const STRONG_INFRA_PATTERNS: RegExp[] = [
  /\b50[234]\b/,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
  /connection refused/i,
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /EAI_AGAIN/,
  /ENOTFOUND/,
  /fetch failed/i,
  /dial tcp/i,
  /socket hang up/i,
  /network is unreachable/i,
  /no such host/i,
  /ENOSPC/,
  /out of memory/i,
];

/** 弱 infra 信号：可能被别的上下文误伤，只在派发错误这类明确语境下用。 */
const WEAK_INFRA_PATTERNS: RegExp[] = [
  /died on SIGKILL/i,
  /killed by SIGKILL/i,
  /premature close/i,
  /socket hang up/i,
  /too many requests/i,
  /rate limit/i,
];

/** 我们自己预算内的超时不是 infra——那是"实现跑太久"，属于实现问题。 */
const OWN_TIMEOUT = /^(implementation|verifier) timed out after/;

export function isInfraMessage(msg: string, weak = false): boolean {
  const text = typeof msg === "string" ? msg : "";
  if (text === "") return false;
  if (OWN_TIMEOUT.test(text)) return false;
  if (STRONG_INFRA_PATTERNS.some((p) => p.test(text))) return true;
  return weak && WEAK_INFRA_PATTERNS.some((p) => p.test(text));
}

/** 派发阶段的错误（实现 Agent 挂了 / 进程被打死）分类。 */
export function classifyDispatchError(msg: string): ErrorClass {
  return isInfraMessage(msg, true) ? "infra" : "impl";
}

/**
 * 验证阶段的错误分类。只认强信号：Verifier 自己吐的 REASON 里出现 "timed out"
 * 是被验证的代码超时，不是基础设施坏了。
 */
export function classifyVerifyError(msg: string): ErrorClass {
  return isInfraMessage(msg, false) ? "infra" : "impl";
}

export function markInfra(reason: string): string {
  return reason.startsWith(INFRA_TAG) ? reason : `${INFRA_TAG} ${reason}`;
}

export function isInfraReason(reason: string | null): boolean {
  return reason !== null && reason.startsWith(INFRA_TAG);
}
