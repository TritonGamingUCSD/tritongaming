'use client';

import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { oddsOf } from '@/lib/staffle/draw';
import type { StaffleView } from './api';
import styles from './staffle.module.css';

// "How It Works": the rules of a Staffle in plain words, and (from this Staffle's own numbers) about how likely each prize is.
export default function StaffleRules({ staffle: s, onClose }: { staffle: StaffleView; onClose: () => void }) {
  return (
    <Dialog title="How A Staffle Works" wide sheet onClose={onClose}>
      <div className={styles.how}>
        <section>
          <h4>Who Can Enter</h4>
          <p>
            Not every Staffle is open to everyone. If you can’t enter one, the page says so. This is checked when you enter (or tick <b>I’ll take anything left</b>), against your
            roles, warnings and strikes at that moment, and only while the Staffle is open.
          </p>
        </section>
        <section>
          <h4>The Rules</h4>
          <ul>
            <li>
              <b>One entry per prize, one prize per person.</b> Enter every prize you would like; you can win at most one. <b>The one exception:</b> if you are the only person who
              entered a prize, it is yours even if you win another prize too.
            </li>
            <li>
              <b>Prizes are drawn in order,</b> lowest Draw # first, then the most valuable first (prices within 20% count as the same). People who do not win stay in for every
              prize after, so entering a smaller prize never costs you a chance at a bigger one.
            </li>
            <li>
              <b>Prizes of the same rank:</b> the one with the fewest entrants for each winner goes first, so a prize few people picked is likely to go to one of them.
            </li>
            <li>
              <b>A prize with N winners</b> gives N different people. If fewer people entered than there are winners, they all win.
            </li>
            <li>
              <b>If everyone who entered a prize already won something else,</b> they still get it (whoever has won the fewest prizes first) before anyone who did not enter it.
            </li>
            <li>
              <b>Nothing is left in storage by choice.</b> Spots still open after the draw go to people who ticked <b>I’ll take anything left</b>, then to anyone else who may enter
              and has not won (marked “leftover pick”).
            </li>
            <li>
              <b>The draw is saved first,</b> so a reload shows the same result, and winners are told right away with how to pick the prize up.
            </li>
          </ul>
        </section>
        <section>
          <h4>Your Chances</h4>
          <p>
            For one prize, your chance is about <b>winners ÷ people who entered it</b>. Entering more prizes never lowers the chance on any of them, and it adds up: with equal
            prizes and everyone entering all of them, your chance of winning something is about prizes ÷ people. The first prize drawn is not affected by what else you enter.
          </p>
          {s.items.length > 0 && (
            <table className={styles.howTable}>
              <thead>
                <tr>
                  <th>Drawn</th>
                  <th>Prize</th>
                  <th>Winners</th>
                  <th>Entered</th>
                  <th>If you enter</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i, n) => {
                  const o = oddsOf(i.entries, i.winners, i.mine);
                  return (
                    <tr key={i.id}>
                      <td>{n + 1}</td>
                      <td>{i.prize.name}</td>
                      <td>{i.winners}</td>
                      <td>{i.entries}</td>
                      <td>{o.all ? 'Everyone wins' : `About 1 in ${o.oneIn}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className={styles.howNote}>
            A guide only: it does not count people who win an earlier prize and drop out of the later ones, which raises everyone else’s chances a little.
          </p>
        </section>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose}>Close</DialogCancel>
      </DialogActions>
    </Dialog>
  );
}
