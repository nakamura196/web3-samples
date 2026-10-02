import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

/**
 * Pulls the custom-error name out of a reverted call so the UI can look up a
 * translated message. Falls back to viem's short message when the revert is not
 * one of ours (out of gas, RPC failure, ...).
 */
export function describeTxError(error: unknown): { key?: string; message: string } | null {
  if (!error) return null;

  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) {
      return { key: 'UserRejected', message: 'Transaction rejected in wallet.' };
    }

    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      return { key: reverted.data.errorName, message: reverted.data.errorName };
    }

    return { message: error.shortMessage };
  }

  return { message: error instanceof Error ? error.message : String(error) };
}
