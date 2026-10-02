import { defineConfig } from '@wagmi/cli';
import { foundry, react } from '@wagmi/cli/plugins';

// tictactoe: contracts/tictactoe の Foundry のビルド結果から ABI と型付きフックを作る。
// コントラクトを変えたら `npm run wagmi`。ABI を手で写さない（古い ABI は実行時まで気づけない）。
export default defineConfig({
  out: 'src/samples/tictactoe/generated/wagmi.ts',
  plugins: [
    foundry({
      project: 'contracts/tictactoe',
      include: ['TicTacToe.sol/**', 'SoloTicTacToe.sol/**'],
    }),
    react(),
  ],
});
