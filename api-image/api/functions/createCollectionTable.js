function createCollectionTable(email, current_device_id, paypal, db_coins) {
  let message = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
>
  <head>
    <!--[if gte mso 9]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG />
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    <![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <!--<![endif]-->
    <title></title>

    <style type="text/css">
      @media only screen and (min-width: 520px) {
        .u-row {
          width: 500px !important;
        }
        .u-row .u-col {
          vertical-align: top;
        }

        .u-row .u-col-100 {
          width: 500px !important;
        }
      }

      @media (max-width: 520px) {
        .u-row-container {
          max-width: 100% !important;
          padding-left: 0px !important;
          padding-right: 0px !important;
        }
        .u-row .u-col {
          min-width: 320px !important;
          max-width: 100% !important;
          display: block !important;
        }
        .u-row {
          width: calc(100% - 40px) !important;
        }
        .u-col {
          width: 100% !important;
        }
        .u-col > div {
          margin: 0 auto;
        }
      }
      body {
        margin: 0;
        padding: 0;
      }

      table,
      tr,
      td {
        vertical-align: top;
        border-collapse: collapse;
      }

      p {
        margin: 0;
      }

      .ie-container table,
      .mso-container table {
        table-layout: fixed;
      }

      * {
        line-height: inherit;
      }

      a[x-apple-data-detectors="true"] {
        color: inherit !important;
        text-decoration: none !important;
      }

      @media (min-width: 0px) {
        .hide-default__display-table {
          display: table !important;
          mso-hide: unset !important;
        }
      }

      @media (max-width: 480px) {
        .hide-mobile {
          max-height: 0px;
          overflow: hidden;
          display: none !important;
        }
      }

      @media (min-width: 481px) {
        .hide-desktop {
          max-height: 0px;
          overflow: hidden;
          display: none !important;
        }
      }
      table,
      td {
        color: #000000;
      }
      @media (max-width: 480px) {
        #u_row_1 .v-row-background-color {
          background-color: #8787b6 !important;
        }
        #u_row_1.v-row-background-color {
          background-color: #8787b6 !important;
        }
        #u_column_1 .v-col-padding {
          padding: 0px !important;
        }
      }
    </style>
    <style type="text/css">
    .tg {
      border: none;
      border-collapse: collapse;
      border-color: #aabcfe;
      border-spacing: 0;
    }
    .tg td {
      background-color: #e8edff;
      border-color: #aabcfe;
      border-style: solid;
      border-width: 0px;
      color: #669;
      font-family: Arial, sans-serif;
      font-size: 14px;
      overflow: hidden;
      padding: 12px 12px;
      word-break: normal;
    }
    .tg th {
      background-color: #b9c9fe;
      border-color: #aabcfe;
      border-style: solid;
      border-width: 0px;
      color: #039;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: normal;
      overflow: hidden;
      padding: 12px 12px;
      word-break: normal;
    }
    .tg .tg-8p4a {
      border-color: inherit;
      font-family: "Times New Roman", Times,
        serif !important;
      font-size: 24px;
      text-align: center;
      vertical-align: top;
    }
    .tg .tg-aboz {
      border-color: inherit;
      font-family: "Times New Roman", Times,
        serif !important;
      font-size: 18px;
      text-align: left;
      vertical-align: top;
    }
  </style>

    <!--[if !mso]><!-->
    <link
      href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
      rel="stylesheet"
      type="text/css"
    />
    <!--<![endif]-->
  </head>

  <body
    class="clean-body u_body"
    style="
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      background-color: #e7e7e7;
      color: #000000;
    "
  >
    <!--[if IE]><div class="ie-container"><![endif]-->
    <!--[if mso]><div class="mso-container"><![endif]-->
    <table
      style="
        border-collapse: collapse;
        table-layout: fixed;
        border-spacing: 0;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
        vertical-align: top;
        min-width: 320px;
        margin: 0 auto;
        background-color: #e7e7e7;
        width: 100%;
      "
      cellpadding="0"
      cellspacing="0"
    >
      <tbody>
        <tr style="vertical-align: top">
          <td
            style="
              word-break: break-word;
              border-collapse: collapse !important;
              vertical-align: top;
            "
          >
            <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color: #e7e7e7;"><![endif]-->

            <div
              id="u_row_1"
              class="u-row-container v-row-background-color"
              style="padding: 0px; background-color: #9090b9"
            >
              <div
                class="u-row"
                style="
                  margin: 0 auto;
                  min-width: 320px;
                  max-width: 500px;
                  overflow-wrap: break-word;
                  word-wrap: break-word;
                  word-break: break-word;
                  background-color: transparent;
                "
              >
                <div
                  style="
                    border-collapse: collapse;
                    display: table;
                    width: 100%;
                    height: 100%;
                    background-color: transparent;
                  "
                >
                  <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="v-row-background-color" style="padding: 0px;background-color: #9090b9;" align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:500px;"><tr style="background-color: transparent;"><![endif]-->

                  <!--[if (mso)|(IE)]><td align="center" width="500" class="v-col-padding" style="background-color: #767699;width: 500px;padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;" valign="top"><![endif]-->
                  <div
                    id="u_column_1"
                    class="u-col u-col-100"
                    style="
                      max-width: 320px;
                      min-width: 500px;
                      display: table-cell;
                      vertical-align: top;
                    "
                  >
                    <div
                      style="
                        background-color: #767699;
                        height: 100%;
                        width: 100% !important;
                      "
                    >
                      <!--[if (!mso)&(!IE)]><!--><div
                        class="v-col-padding"
                        style="
                          height: 100%;
                          padding: 0px;
                          border-top: 0px solid transparent;
                          border-left: 0px solid transparent;
                          border-right: 0px solid transparent;
                          border-bottom: 0px solid transparent;
                        "
                      ><!--<![endif]-->
                        <table
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 60px 10px 10px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <table
                                  width="100%"
                                  cellpadding="0"
                                  cellspacing="0"
                                  border="0"
                                >
                                  <tr>
                                    <td
                                      style="
                                        padding-right: 0px;
                                        padding-left: 0px;
                                      "
                                      align="center"
                                    >
                                      <img
                                        align="center"
                                        border="0"
                                        src="https://drive.google.com/uc?id=1og0vwD88wSs9rJoqQuMr2eUX1nyevwT_"
                                        alt=""
                                        title=""
                                        style="
                                          outline: none;
                                          text-decoration: none;
                                          -ms-interpolation-mode: bicubic;
                                          clear: both;
                                          display: inline-block !important;
                                          border: none;
                                          height: auto;
                                          float: none;
                                          width: 23%;
                                          max-width: 110.4px;
                                        "
                                        width="110.4"
                                      />
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 10px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <h1
                                  style="
                                    margin: 0px;
                                    color: #ffffff;
                                    line-height: 140%;
                                    text-align: center;
                                    word-wrap: break-word;
                                    font-weight: normal;
                                    font-family: times new roman, times;
                                    font-size: 28px;
                                  "
                                >
                                  <div>
                                    <div><strong>Blue Kiwi</strong></div>
                                  </div>
                                </h1>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 50px 10px 10px 25px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <h1
                                  style="
                                    margin: 0px;
                                    color: #ffffff;
                                    line-height: 140%;
                                    text-align: left;
                                    word-wrap: break-word;
                                    font-weight: normal;
                                    font-family: times new roman, times;
                                    font-size: 22px;
                                  "
                                >
                                  <div>
                                    <div>
                                      <div>
                                        <strong>Transaction Info</strong>
                                      </div>
                                    </div>
                                  </div>
                                </h1>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 10px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <table
                                  height="0px"
                                  align="center"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  width="100%"
                                  style="
                                    border-collapse: collapse;
                                    table-layout: fixed;
                                    border-spacing: 0;
                                    mso-table-lspace: 0pt;
                                    mso-table-rspace: 0pt;
                                    vertical-align: top;
                                    border-top: 1px solid #bbbbbb;
                                    -ms-text-size-adjust: 100%;
                                    -webkit-text-size-adjust: 100%;
                                  "
                                >
                                  <tbody>
                                    <tr style="vertical-align: top">
                                      <td
                                        style="
                                          word-break: break-word;
                                          border-collapse: collapse !important;
                                          vertical-align: top;
                                          font-size: 0px;
                                          line-height: 0px;
                                          mso-line-height-rule: exactly;
                                          -ms-text-size-adjust: 100%;
                                          -webkit-text-size-adjust: 100%;
                                        "
                                      >
                                        <span>&#160;</span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table
                          class="hide-mobile"
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 10px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <div>
 
                                  <table
                                    class="tg"
                                    style="table-layout: fixed; width: 482px"
                                  >
                                    <colgroup>
                                      <col style="width: 101px" />
                                      <col style="width: 381px" />
                                    </colgroup>
                                    <thead>
                                      <tr>
                                        <th class="tg-8p4a" colspan="2">
                                          User Data
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td class="tg-aboz">Email</td>
                                        <td class="tg-aboz">
                                          ${email}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td class="tg-aboz">Device ID</td>
                                        <td class="tg-aboz">${current_device_id}</td>
                                      </tr>
                                      <tr>
                                        <td class="tg-aboz">PayPal</td>
                                        <td class="tg-aboz">${paypal}</td>
                                      </tr>
                                      <tr>
                                        <td class="tg-aboz">Coins</td>
                                        <td class="tg-aboz">${db_coins}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <!--[if !mso]><!-->
                        <table
                          class="hide-default__display-table hide-desktop"
                          style="
                            display: none;
                            mso-hide: all;
                            font-family: arial, helvetica, sans-serif;
                          "
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 25px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <div
                                  style="
                                    color: #ffffff;
                                    line-height: 140%;
                                    text-align: left;
                                    word-wrap: break-word;
                                  "
                                >
                                  <p
                                    style="
                                      font-size: 14px;
                                      line-height: 140%;
                                      text-align: left;
                                    "
                                  >
                                    <span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >Email: </span
                                    ><span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >${email}</span
                                    >
                                  </p>
                                  <p
                                    style="
                                      font-size: 14px;
                                      line-height: 140%;
                                      text-align: left;
                                    "
                                  >
                                    <span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >Device ID: </span
                                    ><span
                                      style="
                                        font-family: 'times new roman', times;
                                        font-size: 20px;
                                        text-align: center;
                                        line-height: 28px;
                                      "
                                      >${current_device_id}</span
                                    >
                                  </p>
                                  <p
                                    style="
                                      font-size: 14px;
                                      line-height: 140%;
                                      text-align: left;
                                    "
                                  >
                                    <span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >PayPal: </span
                                    ><span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >${paypal}</span
                                    >
                                  </p>
                                  <p
                                    style="
                                      font-size: 14px;
                                      line-height: 140%;
                                      text-align: left;
                                    "
                                  >
                                    <span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >Coins: </span
                                    ><span
                                      style="
                                        font-size: 20px;
                                        line-height: 28px;
                                        font-family: 'times new roman', times;
                                      "
                                      >${db_coins}</span
                                    >
                                  </p>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <!--<![endif]-->
                        <table
                          style="font-family: arial, helvetica, sans-serif"
                          role="presentation"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          border="0"
                        >
                          <tbody>
                            <tr>
                              <td
                                style="
                                  overflow-wrap: break-word;
                                  word-break: break-word;
                                  padding: 120px 10px 10px;
                                  font-family: arial, helvetica, sans-serif;
                                "
                                align="left"
                              >
                                <div
                                  style="
                                    line-height: 140%;
                                    text-align: left;
                                    word-wrap: break-word;
                                  "
                                >
                                  <p
                                    style="
                                      font-size: 14px;
                                      line-height: 140%;
                                      text-align: center;
                                    "
                                  >
                                    <span
                                      style="
                                        font-family: 'Great Vibes';
                                        font-size: 14px;
                                        line-height: 19.6px;
                                      "
                                      ><strong
                                        ><span
                                          style="
                                            font-size: 20px;
                                            line-height: 28px;
                                          "
                                          ><em>Blue Kiwi.</em></span
                                        ></strong
                                      ></span
                                    >
                                  </p>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <!--[if (!mso)&(!IE)]><!-->
                      </div>
                      <!--<![endif]-->
                    </div>
                  </div>
                  <!--[if (mso)|(IE)]></td><![endif]-->
                  <!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]-->
                </div>
              </div>
            </div>

            <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
          </td>
        </tr>
      </tbody>
    </table>
    <!--[if mso]></div><![endif]-->
    <!--[if IE]></div><![endif]-->
  </body>
</html>

    `;

  return message;
}

module.exports = { createCollectionTable };
