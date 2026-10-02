"""unittest だけで動く。pytest は不要。

    PYTHONPATH=src python -m unittest discover -s tests -v
"""

from __future__ import annotations

import math
import unittest

import numpy as np

from zkshor import attacks, group, ledger, schnorr, shor_dlog, shor_factor
from zkshor.qsim import QuditPair, qft_apply, qft_matrix

SMALL = group.toy(8)


class TestGroup(unittest.TestCase):
    def test_validate(self):
        SMALL.validate()

    def test_generator_order(self):
        self.assertEqual(pow(SMALL.g, SMALL.q, SMALL.p), 1)
        self.assertNotEqual(SMALL.g, 1)

    def test_membership_rejects_outsiders(self):
        # 群の外の元を弾けること (small-subgroup 攻撃への最低限の防御)
        outsiders = [h for h in range(2, SMALL.p) if not SMALL.contains(h)]
        self.assertTrue(outsiders)
        self.assertFalse(SMALL.contains(outsiders[0]))

    def test_roundtrip_json(self):
        self.assertEqual(group.Group.from_json(SMALL.to_json()).q, SMALL.q)


class TestSchnorr(unittest.TestCase):
    def setUp(self):
        self.kp = schnorr.keygen(SMALL)

    def test_completeness(self):
        for ctx in (b"", b"hello", b"\x00\xff"):
            pf = schnorr.prove(self.kp, ctx)
            self.assertTrue(schnorr.verify(SMALL, self.kp.y, pf, ctx))

    def test_context_binding(self):
        pf = schnorr.prove(self.kp, b"pay 100")
        self.assertFalse(schnorr.verify(SMALL, self.kp.y, pf, b"pay 900"))

    def test_statement_binding(self):
        """他人の鍵に対して証明を使い回せないこと。"""
        other = schnorr.keygen(SMALL)
        pf = schnorr.prove(other, b"x")
        self.assertFalse(schnorr.verify(SMALL, self.kp.y, pf, b"x"))

    def test_zero_knowledge_simulator(self):
        for _ in range(20):
            tr = schnorr.simulate(SMALL, self.kp.y)
            self.assertTrue(schnorr.verify_transcript(SMALL, self.kp.y, tr))

    def test_simulator_distribution(self):
        """本物と模擬の (c, s) が同じ一様分布であること (粗い検定)。"""
        real, sim = [], []
        for _ in range(400):
            real.append(schnorr.interact(self.kp).s)
            sim.append(schnorr.simulate(SMALL, self.kp.y).s)
        self.assertAlmostEqual(
            sum(real) / len(real) / SMALL.q, sum(sim) / len(sim) / SMALL.q,
            delta=0.15,
        )

    def test_special_soundness(self):
        r, t = schnorr.commit(SMALL)
        tr1 = schnorr.Transcript(t, 3, schnorr.respond(SMALL, self.kp.x, r, 3))
        tr2 = schnorr.Transcript(t, 5, schnorr.respond(SMALL, self.kp.x, r, 5))
        self.assertEqual(schnorr.extract(SMALL, tr1, tr2), self.kp.x)

    def test_extract_requires_distinct_challenges(self):
        r, t = schnorr.commit(SMALL)
        tr = schnorr.Transcript(t, 3, schnorr.respond(SMALL, self.kp.x, r, 3))
        with self.assertRaises(ValueError):
            schnorr.extract(SMALL, tr, tr)


class TestClassicalAttacks(unittest.TestCase):
    def setUp(self):
        self.kp = schnorr.keygen(SMALL)

    def test_nonce_reuse(self):
        r, t = schnorr.commit(SMALL)
        trs = [schnorr.Transcript(t, c, schnorr.respond(SMALL, self.kp.x, r, c))
               for c in (11, 13)]
        self.assertEqual(attacks.nonce_reuse(SMALL, *trs).x, self.kp.x)

    def test_bsgs(self):
        res = attacks.bsgs(SMALL, self.kp.y)
        self.assertEqual(res.x, self.kp.x)
        self.assertLessEqual(res.ops, 3 * (math.isqrt(SMALL.q) + 2))

    def test_pollard_rho(self):
        # rho は確率的に縮退することがあるので数回試す
        for _ in range(10):
            res = attacks.pollard_rho(SMALL, self.kp.y)
            if res.ok:
                self.assertEqual(res.x, self.kp.x)
                return
        self.skipTest("pollard rho degenerated 10 times (rare but possible)")


class TestQFT(unittest.TestCase):
    def test_fft_matches_matrix(self):
        """FFT 版の QFT が、定義どおりの行列積と一致すること。"""
        q = 37
        rng = np.random.default_rng(0)
        psi = rng.normal(size=(q, q)) + 1j * rng.normal(size=(q, q))
        psi /= np.linalg.norm(psi)

        a = QuditPair(q)
        a.psi = psi.copy()
        a.qft_both(exact_matrix=True)

        b = QuditPair(q)
        b.psi = psi.copy()
        b.qft_both(exact_matrix=False)

        self.assertLess(np.abs(a.psi - b.psi).max(), 1e-10)

    def test_unitary(self):
        f = qft_matrix(23)
        self.assertLess(np.abs(f.conj().T @ f - np.eye(23)).max(), 1e-12)

    def test_qft_1d_norm(self):
        psi = np.zeros(64, dtype=complex)
        psi[0] = 1.0
        out = qft_apply(psi)
        self.assertAlmostEqual(np.linalg.norm(out), 1.0, places=12)


class TestShorDlog(unittest.TestCase):
    def test_recovers_secret(self):
        kp = schnorr.keygen(SMALL)
        res = shor_dlog.shor_dlog(SMALL, kp.y, verbose=False)
        self.assertTrue(res.ok)
        self.assertEqual(res.x, kp.x)
        self.assertTrue(res.exact)

    def test_interference_is_exact(self):
        """d = c*x 以外の振幅が数値誤差の範囲でゼロであること。"""
        kp = schnorr.keygen(SMALL)
        info = shor_dlog.peak_structure(SMALL, kp.y, seed=1)
        self.assertEqual(info["x"], kp.x)
        self.assertAlmostEqual(info["prob_on_line"], 1.0, places=9)
        self.assertLess(info["max_off_line"], 1e-20)
        self.assertEqual(info["nonzero_cells"], SMALL.q)

    def test_refuses_real_size(self):
        with self.assertRaises(ValueError):
            shor_dlog.shor_dlog(group.make_group(40, 80), 2, verbose=False)


class TestShorFactor(unittest.TestCase):
    def test_convergents(self):
        convs = shor_factor.continued_fraction_convergents(32768, 262144)
        self.assertIn(8, [c.denominator for c in convs])

    def test_convergents_match_value(self):
        convs = shor_factor.continued_fraction_convergents(355, 113)
        self.assertEqual(float(convs[-1]), 355 / 113)

    def test_factors_15(self):
        res = shor_factor.shor_factor(15, max_shots=40, verbose=False)
        self.assertTrue(res.ok)
        self.assertEqual(sorted(res.factors), [3, 5])

    def test_factors_toy_rsa(self):
        rsa = shor_factor.toy_rsa()
        res = shor_factor.shor_factor(rsa.n, max_shots=40, verbose=False)
        self.assertTrue(res.ok)
        d = shor_factor.recover_rsa_private_key(rsa.n, rsa.e, res.factors)
        self.assertEqual(d, rsa.d)
        self.assertEqual(rsa.decrypt(rsa.encrypt(7)), 7)
        self.assertEqual(pow(rsa.encrypt(7), d, rsa.n), 7)


class TestLedger(unittest.TestCase):
    def setUp(self):
        self.alice = ledger.Account(SMALL, schnorr.keygen(SMALL))
        self.mallory = ledger.Account(SMALL, schnorr.keygen(SMALL))
        self.book = ledger.Ledger(SMALL)
        self.book.credit(self.alice.address, 1000)

    def test_honest_payment(self):
        ok, why = self.book.apply(self.alice.pay(self.mallory.address, 10))
        self.assertTrue(ok, why)
        self.assertEqual(self.book.balances[self.alice.address], 990)

    def test_impersonation_fails_today(self):
        bad = ledger.forge_payment(SMALL, self.mallory.kp.x,
                                   self.alice.address, self.mallory.address, 5, 1)
        self.assertFalse(self.book.apply(bad)[0])

    def test_replay_rejected(self):
        tx = self.alice.pay(self.mallory.address, 10)
        self.assertTrue(self.book.apply(tx)[0])
        self.assertFalse(self.book.apply(tx)[0])

    def test_harvest_then_forge(self):
        self.book.apply(self.alice.pay(self.mallory.address, 1))
        harvested = self.book.harvest_pubkeys()[self.alice.address]
        res = shor_dlog.shor_dlog(SMALL, harvested, verbose=False)
        self.assertTrue(res.ok)
        self.assertEqual(res.x, self.alice.kp.x)
        forged = ledger.forge_payment(SMALL, res.x, self.alice.address,
                                      self.mallory.address, 500, 2)
        ok, why = self.book.apply(forged)
        self.assertTrue(ok, why)
        self.assertEqual(self.book.balances[self.mallory.address], 501)


if __name__ == "__main__":
    unittest.main(verbosity=2)
