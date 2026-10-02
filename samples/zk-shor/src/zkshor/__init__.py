"""zk-shor — ゼロ知識証明を自分で書き、それを Shor で破るまでを1つに収めた教材。

    from zkshor import group, schnorr, attacks, shor_dlog, shor_factor, ledger

CLI:  python -m zkshor all
"""

__version__ = "0.1.0"

from . import attacks, estimate, group, ledger, schnorr, shor_dlog, shor_factor  # noqa: F401
