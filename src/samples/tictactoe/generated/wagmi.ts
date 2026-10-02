import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SoloTicTacToe
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const soloTicTacToeAbi = [
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'boardOf',
    outputs: [{ name: 'cells', internalType: 'uint8[9]', type: 'uint8[9]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'gameCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'getGame',
    outputs: [
      {
        name: '',
        internalType: 'struct SoloTicTacToe.Solo',
        type: 'tuple',
        components: [
          { name: 'player', internalType: 'address', type: 'address' },
          { name: 'boardPlayer', internalType: 'uint16', type: 'uint16' },
          { name: 'boardCpu', internalType: 'uint16', type: 'uint16' },
          { name: 'moves', internalType: 'uint8', type: 'uint8' },
          {
            name: 'difficulty',
            internalType: 'enum SoloTicTacToe.Difficulty',
            type: 'uint8',
          },
          {
            name: 'result',
            internalType: 'enum SoloTicTacToe.Result',
            type: 'uint8',
          },
          { name: 'cpuFirst', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'offset', internalType: 'uint256', type: 'uint256' },
      { name: 'limit', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getGames',
    outputs: [
      {
        name: 'page',
        internalType: 'struct SoloTicTacToe.Solo[]',
        type: 'tuple[]',
        components: [
          { name: 'player', internalType: 'address', type: 'address' },
          { name: 'boardPlayer', internalType: 'uint16', type: 'uint16' },
          { name: 'boardCpu', internalType: 'uint16', type: 'uint16' },
          { name: 'moves', internalType: 'uint8', type: 'uint8' },
          {
            name: 'difficulty',
            internalType: 'enum SoloTicTacToe.Difficulty',
            type: 'uint8',
          },
          {
            name: 'result',
            internalType: 'enum SoloTicTacToe.Result',
            type: 'uint8',
          },
          { name: 'cpuFirst', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'difficulty',
        internalType: 'enum SoloTicTacToe.Difficulty',
        type: 'uint8',
      },
      { name: 'cpuFirst', internalType: 'bool', type: 'bool' },
    ],
    name: 'newGame',
    outputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'gameId', internalType: 'uint256', type: 'uint256' },
      { name: 'cell', internalType: 'uint8', type: 'uint8' },
    ],
    name: 'play',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'boardCpu', internalType: 'uint16', type: 'uint16' },
      { name: 'boardPlayer', internalType: 'uint16', type: 'uint16' },
      {
        name: 'difficulty',
        internalType: 'enum SoloTicTacToe.Difficulty',
        type: 'uint8',
      },
      { name: 'seed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'previewCpuMove',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'player',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'difficulty',
        internalType: 'enum SoloTicTacToe.Difficulty',
        type: 'uint8',
        indexed: false,
      },
      { name: 'cpuFirst', internalType: 'bool', type: 'bool', indexed: false },
      { name: 'cpuCell', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'GameCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'result',
        internalType: 'enum SoloTicTacToe.Result',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'GameFinished',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'player',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'playerCell',
        internalType: 'uint8',
        type: 'uint8',
        indexed: false,
      },
      { name: 'cpuCell', internalType: 'uint8', type: 'uint8', indexed: false },
      {
        name: 'result',
        internalType: 'enum SoloTicTacToe.Result',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'MovePlayed',
  },
  { type: 'error', inputs: [], name: 'BoardFull' },
  {
    type: 'error',
    inputs: [{ name: 'cell', internalType: 'uint8', type: 'uint8' }],
    name: 'CellOutOfRange',
  },
  {
    type: 'error',
    inputs: [{ name: 'cell', internalType: 'uint8', type: 'uint8' }],
    name: 'CellTaken',
  },
  {
    type: 'error',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'GameOver',
  },
  {
    type: 'error',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'NoSuchGame',
  },
  {
    type: 'error',
    inputs: [
      { name: 'caller', internalType: 'address', type: 'address' },
      { name: 'player', internalType: 'address', type: 'address' },
    ],
    name: 'NotYourGame',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TicTacToe
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ticTacToeAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'initialFeeBps', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_FEE_BPS',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_TIMEOUT',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MIN_TIMEOUT',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'boardOf',
    outputs: [{ name: 'cells', internalType: 'uint8[9]', type: 'uint8[9]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'cancelGame',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'claimTimeout',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'invitedOpponent', internalType: 'address', type: 'address' },
      { name: 'timeout', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'createGame',
    outputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'currentPlayer',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feeBps',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'gameCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'getGame',
    outputs: [
      {
        name: '',
        internalType: 'struct TicTacToe.Game',
        type: 'tuple',
        components: [
          { name: 'playerX', internalType: 'address', type: 'address' },
          { name: 'stake', internalType: 'uint96', type: 'uint96' },
          { name: 'playerO', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
          { name: 'timeout', internalType: 'uint32', type: 'uint32' },
          { name: 'winner', internalType: 'address', type: 'address' },
          { name: 'boardX', internalType: 'uint16', type: 'uint16' },
          { name: 'boardO', internalType: 'uint16', type: 'uint16' },
          { name: 'moves', internalType: 'uint8', type: 'uint8' },
          {
            name: 'status',
            internalType: 'enum TicTacToe.Status',
            type: 'uint8',
          },
          {
            name: 'outcome',
            internalType: 'enum TicTacToe.Outcome',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'offset', internalType: 'uint256', type: 'uint256' },
      { name: 'limit', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getGames',
    outputs: [
      {
        name: 'page',
        internalType: 'struct TicTacToe.Game[]',
        type: 'tuple[]',
        components: [
          { name: 'playerX', internalType: 'address', type: 'address' },
          { name: 'stake', internalType: 'uint96', type: 'uint96' },
          { name: 'playerO', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
          { name: 'timeout', internalType: 'uint32', type: 'uint32' },
          { name: 'winner', internalType: 'address', type: 'address' },
          { name: 'boardX', internalType: 'uint16', type: 'uint16' },
          { name: 'boardO', internalType: 'uint16', type: 'uint16' },
          { name: 'moves', internalType: 'uint8', type: 'uint8' },
          {
            name: 'status',
            internalType: 'enum TicTacToe.Status',
            type: 'uint8',
          },
          {
            name: 'outcome',
            internalType: 'enum TicTacToe.Outcome',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'joinGame',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'pending',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'gameId', internalType: 'uint256', type: 'uint256' },
      { name: 'cell', internalType: 'uint8', type: 'uint8' },
    ],
    name: 'play',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newFeeBps', internalType: 'uint16', type: 'uint16' }],
    name: 'setFeeBps',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdraw',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Credited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'feeBps',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'FeeUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'playerX',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'refund',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'GameCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'playerX',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'invitedOpponent',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'stake',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'timeout',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
      {
        name: 'joinDeadline',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'GameCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'outcome',
        internalType: 'enum TicTacToe.Outcome',
        type: 'uint8',
        indexed: false,
      },
      {
        name: 'winner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'payout',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'fee', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'GameFinished',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'playerO',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'moveDeadline',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'GameJoined',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'gameId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'player',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'cell', internalType: 'uint8', type: 'uint8', indexed: false },
      {
        name: 'moveNumber',
        internalType: 'uint8',
        type: 'uint8',
        indexed: false,
      },
      {
        name: 'moveDeadline',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'MovePlayed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  { type: 'error', inputs: [], name: 'CannotPlaySelf' },
  {
    type: 'error',
    inputs: [{ name: 'cell', internalType: 'uint8', type: 'uint8' }],
    name: 'CellOutOfRange',
  },
  {
    type: 'error',
    inputs: [{ name: 'cell', internalType: 'uint8', type: 'uint8' }],
    name: 'CellTaken',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint64', type: 'uint64' }],
    name: 'DeadlineNotReached',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint64', type: 'uint64' }],
    name: 'DeadlinePassed',
  },
  {
    type: 'error',
    inputs: [{ name: 'feeBps', internalType: 'uint16', type: 'uint16' }],
    name: 'FeeTooHigh',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint64', type: 'uint64' }],
    name: 'JoinWindowClosed',
  },
  {
    type: 'error',
    inputs: [{ name: 'gameId', internalType: 'uint256', type: 'uint256' }],
    name: 'NoSuchGame',
  },
  {
    type: 'error',
    inputs: [
      { name: 'caller', internalType: 'address', type: 'address' },
      { name: 'playerX', internalType: 'address', type: 'address' },
    ],
    name: 'NotCreator',
  },
  {
    type: 'error',
    inputs: [
      { name: 'caller', internalType: 'address', type: 'address' },
      { name: 'invited', internalType: 'address', type: 'address' },
    ],
    name: 'NotInvited',
  },
  { type: 'error', inputs: [], name: 'NotOwner' },
  {
    type: 'error',
    inputs: [
      { name: 'caller', internalType: 'address', type: 'address' },
      { name: 'expected', internalType: 'address', type: 'address' },
    ],
    name: 'NotYourTurn',
  },
  { type: 'error', inputs: [], name: 'NothingToWithdraw' },
  {
    type: 'error',
    inputs: [{ name: 'stake', internalType: 'uint256', type: 'uint256' }],
    name: 'StakeTooLarge',
  },
  {
    type: 'error',
    inputs: [{ name: 'timeout', internalType: 'uint32', type: 'uint32' }],
    name: 'TimeoutOutOfRange',
  },
  {
    type: 'error',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'TransferFailed',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sent', internalType: 'uint256', type: 'uint256' },
      { name: 'required', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'WrongStake',
  },
  {
    type: 'error',
    inputs: [
      { name: 'gameId', internalType: 'uint256', type: 'uint256' },
      { name: 'actual', internalType: 'enum TicTacToe.Status', type: 'uint8' },
      {
        name: 'expected',
        internalType: 'enum TicTacToe.Status',
        type: 'uint8',
      },
    ],
    name: 'WrongStatus',
  },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__
 */
export const useReadSoloTicTacToe = /*#__PURE__*/ createUseReadContract({
  abi: soloTicTacToeAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"boardOf"`
 */
export const useReadSoloTicTacToeBoardOf = /*#__PURE__*/ createUseReadContract({
  abi: soloTicTacToeAbi,
  functionName: 'boardOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"gameCount"`
 */
export const useReadSoloTicTacToeGameCount =
  /*#__PURE__*/ createUseReadContract({
    abi: soloTicTacToeAbi,
    functionName: 'gameCount',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"getGame"`
 */
export const useReadSoloTicTacToeGetGame = /*#__PURE__*/ createUseReadContract({
  abi: soloTicTacToeAbi,
  functionName: 'getGame',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"getGames"`
 */
export const useReadSoloTicTacToeGetGames = /*#__PURE__*/ createUseReadContract(
  { abi: soloTicTacToeAbi, functionName: 'getGames' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"previewCpuMove"`
 */
export const useReadSoloTicTacToePreviewCpuMove =
  /*#__PURE__*/ createUseReadContract({
    abi: soloTicTacToeAbi,
    functionName: 'previewCpuMove',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link soloTicTacToeAbi}__
 */
export const useWriteSoloTicTacToe = /*#__PURE__*/ createUseWriteContract({
  abi: soloTicTacToeAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"newGame"`
 */
export const useWriteSoloTicTacToeNewGame =
  /*#__PURE__*/ createUseWriteContract({
    abi: soloTicTacToeAbi,
    functionName: 'newGame',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"play"`
 */
export const useWriteSoloTicTacToePlay = /*#__PURE__*/ createUseWriteContract({
  abi: soloTicTacToeAbi,
  functionName: 'play',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link soloTicTacToeAbi}__
 */
export const useSimulateSoloTicTacToe = /*#__PURE__*/ createUseSimulateContract(
  { abi: soloTicTacToeAbi },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"newGame"`
 */
export const useSimulateSoloTicTacToeNewGame =
  /*#__PURE__*/ createUseSimulateContract({
    abi: soloTicTacToeAbi,
    functionName: 'newGame',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `functionName` set to `"play"`
 */
export const useSimulateSoloTicTacToePlay =
  /*#__PURE__*/ createUseSimulateContract({
    abi: soloTicTacToeAbi,
    functionName: 'play',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link soloTicTacToeAbi}__
 */
export const useWatchSoloTicTacToeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: soloTicTacToeAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `eventName` set to `"GameCreated"`
 */
export const useWatchSoloTicTacToeGameCreatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: soloTicTacToeAbi,
    eventName: 'GameCreated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `eventName` set to `"GameFinished"`
 */
export const useWatchSoloTicTacToeGameFinishedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: soloTicTacToeAbi,
    eventName: 'GameFinished',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link soloTicTacToeAbi}__ and `eventName` set to `"MovePlayed"`
 */
export const useWatchSoloTicTacToeMovePlayedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: soloTicTacToeAbi,
    eventName: 'MovePlayed',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__
 */
export const useReadTicTacToe = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"MAX_FEE_BPS"`
 */
export const useReadTicTacToeMaxFeeBps = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'MAX_FEE_BPS',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"MAX_TIMEOUT"`
 */
export const useReadTicTacToeMaxTimeout = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'MAX_TIMEOUT',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"MIN_TIMEOUT"`
 */
export const useReadTicTacToeMinTimeout = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'MIN_TIMEOUT',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"boardOf"`
 */
export const useReadTicTacToeBoardOf = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'boardOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"currentPlayer"`
 */
export const useReadTicTacToeCurrentPlayer =
  /*#__PURE__*/ createUseReadContract({
    abi: ticTacToeAbi,
    functionName: 'currentPlayer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"feeBps"`
 */
export const useReadTicTacToeFeeBps = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'feeBps',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"gameCount"`
 */
export const useReadTicTacToeGameCount = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'gameCount',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"getGame"`
 */
export const useReadTicTacToeGetGame = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'getGame',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"getGames"`
 */
export const useReadTicTacToeGetGames = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'getGames',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"owner"`
 */
export const useReadTicTacToeOwner = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"pending"`
 */
export const useReadTicTacToePending = /*#__PURE__*/ createUseReadContract({
  abi: ticTacToeAbi,
  functionName: 'pending',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__
 */
export const useWriteTicTacToe = /*#__PURE__*/ createUseWriteContract({
  abi: ticTacToeAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"cancelGame"`
 */
export const useWriteTicTacToeCancelGame = /*#__PURE__*/ createUseWriteContract(
  { abi: ticTacToeAbi, functionName: 'cancelGame' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"claimTimeout"`
 */
export const useWriteTicTacToeClaimTimeout =
  /*#__PURE__*/ createUseWriteContract({
    abi: ticTacToeAbi,
    functionName: 'claimTimeout',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"createGame"`
 */
export const useWriteTicTacToeCreateGame = /*#__PURE__*/ createUseWriteContract(
  { abi: ticTacToeAbi, functionName: 'createGame' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"joinGame"`
 */
export const useWriteTicTacToeJoinGame = /*#__PURE__*/ createUseWriteContract({
  abi: ticTacToeAbi,
  functionName: 'joinGame',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"play"`
 */
export const useWriteTicTacToePlay = /*#__PURE__*/ createUseWriteContract({
  abi: ticTacToeAbi,
  functionName: 'play',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"setFeeBps"`
 */
export const useWriteTicTacToeSetFeeBps = /*#__PURE__*/ createUseWriteContract({
  abi: ticTacToeAbi,
  functionName: 'setFeeBps',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteTicTacToeTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: ticTacToeAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"withdraw"`
 */
export const useWriteTicTacToeWithdraw = /*#__PURE__*/ createUseWriteContract({
  abi: ticTacToeAbi,
  functionName: 'withdraw',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__
 */
export const useSimulateTicTacToe = /*#__PURE__*/ createUseSimulateContract({
  abi: ticTacToeAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"cancelGame"`
 */
export const useSimulateTicTacToeCancelGame =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'cancelGame',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"claimTimeout"`
 */
export const useSimulateTicTacToeClaimTimeout =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'claimTimeout',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"createGame"`
 */
export const useSimulateTicTacToeCreateGame =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'createGame',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"joinGame"`
 */
export const useSimulateTicTacToeJoinGame =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'joinGame',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"play"`
 */
export const useSimulateTicTacToePlay = /*#__PURE__*/ createUseSimulateContract(
  { abi: ticTacToeAbi, functionName: 'play' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"setFeeBps"`
 */
export const useSimulateTicTacToeSetFeeBps =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'setFeeBps',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateTicTacToeTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ticTacToeAbi}__ and `functionName` set to `"withdraw"`
 */
export const useSimulateTicTacToeWithdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ticTacToeAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__
 */
export const useWatchTicTacToeEvent = /*#__PURE__*/ createUseWatchContractEvent(
  { abi: ticTacToeAbi },
)

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"Credited"`
 */
export const useWatchTicTacToeCreditedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'Credited',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"FeeUpdated"`
 */
export const useWatchTicTacToeFeeUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'FeeUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"GameCancelled"`
 */
export const useWatchTicTacToeGameCancelledEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'GameCancelled',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"GameCreated"`
 */
export const useWatchTicTacToeGameCreatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'GameCreated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"GameFinished"`
 */
export const useWatchTicTacToeGameFinishedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'GameFinished',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"GameJoined"`
 */
export const useWatchTicTacToeGameJoinedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'GameJoined',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"MovePlayed"`
 */
export const useWatchTicTacToeMovePlayedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'MovePlayed',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchTicTacToeOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ticTacToeAbi}__ and `eventName` set to `"Withdrawn"`
 */
export const useWatchTicTacToeWithdrawnEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ticTacToeAbi,
    eventName: 'Withdrawn',
  })
