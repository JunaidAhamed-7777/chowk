/* Checks the exported C policy against the TypeScript outputs, bit for bit.
 * cc -std=c99 -ffp-contract=off -O2 exports/c/check.c -o chowk-check && ./chowk-check */
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "chowk_policy.h"
#include "chowk_cases.h"

int main(void) {
  const int count = (int)(sizeof CHOWK_CASES / sizeof CHOWK_CASES[0]);
  int mismatches = 0;
  for (int index = 0; index < count; index++) {
    double output[CHOWK_OUTPUTS];
    chowk_policy(CHOWK_CASES[index].observation, output);
    for (int k = 0; k < CHOWK_OUTPUTS; k++) {
      uint64_t bits;
      memcpy(&bits, &output[k], sizeof bits);
      if (bits != CHOWK_CASES[index].expected[k]) mismatches++;
    }
  }
  const int repeats = 20000;
  double sink = 0.0;
  clock_t start = clock();
  for (int r = 0; r < repeats; r++) {
    double output[CHOWK_OUTPUTS];
    chowk_policy(CHOWK_CASES[r % count].observation, output);
    sink += output[0];
  }
  double micros = 1e6 * (double)(clock() - start) / CLOCKS_PER_SEC / repeats;
  printf("%d cases, %d mismatched outputs; %.2f us per decision; %u bytes of weights (checksum %g)\n",
         count, mismatches, micros, (unsigned)sizeof CHOWK_WEIGHTS, sink);
  return mismatches == 0 ? 0 : 1;
}
