var path = require('path');
var fs = require('fs');
var shortid = require('shortid');

module.exports = {
  test1_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          cert: '-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQDlN4Axwf2TVzANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwls\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
          key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA3EnHhpaMnnxbVoMvLwu6PMOgU2qFzHNo7LzDsU9aVBz194yZ\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
        }
      }
    }
  },
  test2_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          certPath: __dirname + path.sep + 'b7_cert.pem',
          keyPath: __dirname + path.sep + 'b7_key.rsa'
        }
      }
    }
  },
  test3_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          certPath: path.resolve(__dirname, '../test-temp') + path.sep + 'b7_cert' + shortid.generate() + '.pem',
          keyPath: path.resolve(__dirname, '../test-temp') + path.sep + 'b7_key' + shortid.generate() + '.rsa'
        }
      }
    }
  },
  test4_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          cert: '-----BEGIN CERTIFICATE-----\n<CORRUPT>\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
          key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA3EnHhpaMnnxbVoMvLwu6PMOgU2qFzHNo7LzDsU9aVBz194yZ\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
        }
      }
    }
  },
  test5_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          cert: '-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQDlN4Axwf2TVzANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwls\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
          key: '-----BEGIN RSA PRIVATE KEY-----\n<CORRUPT>\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
        }
      }
    }
  },
  test6_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          cert: '-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQDlN4Axwf2TVzANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwls\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
        }
      }
    }
  },
  test7_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          key: '-----BEGIN RSA PRIVATE KEY-----\n<CORRUPT>\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
        }
      }
    }
  },
  test8_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          certPath: __dirname + path.sep + 'b7_cert.pem',
          keyPath: __dirname + path.sep + 'b7_key_notexist.rsa'
        }
      }
    }
  },
  test9_config: {
    services:{
      transport:{
        config:{
          mode: 'https',
          certPath: __dirname + path.sep + 'b7_cert_notexist.pem',
          keyPath: __dirname + path.sep + 'b7_key.rsa'
        }
      }
    }
  }
};
