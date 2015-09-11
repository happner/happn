objective({
  title: 'Untitled',
  uuid: '2aeb08f8-ac23-4664-8cf3-d5c2c563a7ce',
  description: '',
  repl: {
    listen: '/tmp/socket-2aeb08f8-ac23-4664-8cf3-d5c2c563a7ce'
  },
  once: false,
  plugins: {
    'objective_dev': {
      sourceDir: 'lib',
      testDir: 'objectives',
      testAppend: '_test',
      runAll: true,
      showTrace: true,
      filterTrace: true
    }
  }
}).run(function() {});
