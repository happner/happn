/* 
 * node_modules/.bin/objective --once
 *
 */

objective({
  title: 'happn',
  uuid: '67083bd3-15c1-4245-a0bf-1ece0ef3f0ad',
  description: '',
  repl: {
    listen: '/tmp/socket-67083bd3-15c1-4245-a0bf-1ece0ef3f0ad'
  },
  once: false,
  plugins: {
    'objective_dev': {
      sourceDir: 'lib',
      testDir: 'objective',
      testAppend: '_test',
      runAll: true,
      showTrace: true,
      filterTrace: false
    }
  }
}).run(function() {});
