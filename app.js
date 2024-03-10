require("dotenv").config();
const Web3 = require("web3");

const tokenMessengerAbi = require("./abis/cctp/TokenMessenger.json");
const messageAbi = require("./abis/cctp/Message.json");
const usdcAbi = require("./abis/Usdc.json");
const messageTransmitterAbi = require("./abis/cctp/MessageTransmitter.json");
const { default: axios } = require("axios");
const tradeAbi = require("./abis/tradeAbi.json");
const routeAbi = require("./abis/router.json");
const SWAP02ADDRESS = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";
const BASEWETH = "0x4200000000000000000000000000000000000006";
const BASEUSDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const DEPLOYED = "0xBF4641efF4608810D1e13534797f25cbB38E8ffa";
//  0x6A47D681e082cc56D7f4BE2dc23480c0F0969bf9
const waitForTransaction = async (web3, txHash) => {
  let transactionReceipt = await web3.eth.getTransactionReceipt(txHash);
  while (transactionReceipt != null && transactionReceipt.status === "FALSE") {
    transactionReceipt = await web3.eth.getTransactionReceipt(txHash);
    await new Promise((r) => setTimeout(r, 4000));
  }
  return transactionReceipt;
};

const routerTransfer = async (web3, value) => {
  const tradeContract = new web3.eth.Contract(routeAbi, DEPLOYED);
  const baseSigner = web3.eth.accounts.privateKeyToAccount(
    process.env.BASE_PRIVATE_KEY
  );
  web3.eth.accounts.wallet.add(baseSigner);
  console.log("baseSigner", baseSigner);
  //   return;
  let estimated = await tradeContract.methods
    .swapExactInputSingle02(value.toString())
    .estimateGas();
  console.log("estimated", estimated);

  let dataCalling = tradeContract.methods
    .swapExactInputSingle02(value.toString())
    .encodeABI();
  //   return;
  const transactionFromAtoB = {
    to: DEPLOYED,
    gas: Web3.utils.toHex(estimated),
    data: dataCalling,
    gasPrice: Web3.utils.toHex(20000000000),
  };
  const signedTxAtoB = await web3.eth.accounts.signTransaction(
    transactionFromAtoB,
    process.env.BASE_PRIVATE_KEY
  );
  const receipt = await new Promise((resolve, reject) => {
    web3.eth
      .sendSignedTransaction(signedTxAtoB.rawTransaction)
      .on("transactionHash", (hash) =>
        console.log("Tx Hash: Transferring WETH ", hash)
      )
      .on("receipt", (receipt) => resolve(receipt))
      .on("error", (error) => reject(error));
  });

  console.log("Transaction mined:", receipt);
  return;
};
const transferUsdc = async (
  web3,
  USDC_BASE_CONTRACT_ADDRESS,
  toAddress,
  triggerAddress,
  value,
  ticker,
  tickerAddress
) => {
  const price = (
    await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`
    )
  ).data.axelar.usd;
  const newValue = price * value * 1e6;
  console.log("newValue", newValue);

  const tradeContract = new web3.eth.Contract(tradeAbi, tickerAddress);
  const baseSigner = web3.eth.accounts.privateKeyToAccount(
    process.env.BASE_PRIVATE_KEY
  );
  web3.eth.accounts.wallet.add(baseSigner);
  let dataFortransfer = tradeContract.methods
    .transfer(toAddress, (value * 1e18).toString())
    .encodeABI();

  const transactionFromAtoB = {
    to: tickerAddress,
    gas: Web3.utils.toHex(100000),
    data: dataFortransfer,
  };
  const signedTxAtoB = await web3.eth.accounts.signTransaction(
    transactionFromAtoB,
    process.env.BASE_PRIVATE_KEY
  );
  await web3.eth.sendSignedTransaction(
    signedTxAtoB.rawTransaction,
    function (error, hash) {
      if (!error) {
        console.log("Tx Hash:Transferring WETH ", hash);
      } else {
        console.log("Error sending Tx:", error);
      }
    }
  );
  //   return;
  const usdcBaseContract = new web3.eth.Contract(
    usdcAbi,
    USDC_BASE_CONTRACT_ADDRESS
  );
  let data = usdcBaseContract.methods
    .transfer(triggerAddress, newValue.toString())
    .encodeABI();

  const transaction = {
    to: USDC_BASE_CONTRACT_ADDRESS,
    gas: Web3.utils.toHex(100000),
    data: data,
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    transaction,
    process.env.WALLET_2_PK
  );

  await web3.eth.sendSignedTransaction(
    signedTx.rawTransaction,
    function (error, hash) {
      if (!error) {
        console.log("Tx Hash: transferring USDC ", hash);
      } else {
        console.log("Error sending Tx:", error);
      }
    }
  );
  return newValue.toString();
};

const main = async () => {
  const web3 = new Web3(process.env.BASE_TESTNET_RPC);
  let amount = await routerTransfer(web3, (amountToSend = 1));
  if (!amount) {
    amount = 1;
  }
  // return;
  // Add base private key used for signing transactions
  const baseSigner = web3.eth.accounts.privateKeyToAccount(
    process.env.BASE_PRIVATE_KEY
  );

  web3.eth.accounts.wallet.add(baseSigner);

  // Add ARBITRUM private key used for signing transactions
  const arbitrumSigner = web3.eth.accounts.privateKeyToAccount(
    process.env.ARBITRUM_PRIVATE_KEY
  );
  web3.eth.accounts.wallet.add(arbitrumSigner);

  // Testnet Contract Addresses
  const BASE_TOKEN_MESSENGER_CONTRACT_ADDRESS =
    "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5";
  const USDC_BASE_CONTRACT_ADDRESS =
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const BASE_MESSAGE_CONTRACT_ADDRESS =
    "0x1a9695e9dbdb443f4b20e3e4ce87c8d963fda34f";
  const ARBITRUM_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS =
    "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872";

  // initialize contracts using address and ABI
  const ethTokenMessengerContract = new web3.eth.Contract(
    tokenMessengerAbi,
    BASE_TOKEN_MESSENGER_CONTRACT_ADDRESS,
    { from: baseSigner.address }
  );
  const usdcBaseContract = new web3.eth.Contract(
    usdcAbi,
    USDC_BASE_CONTRACT_ADDRESS,
    { from: baseSigner.address }
  );

  const arbitrumMessageTransmitterContract = new web3.eth.Contract(
    messageTransmitterAbi,
    ARBITRUM_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS,
    { from: arbitrumSigner.address }
  );

  // ARBITRUM destination address
  const mintRecipient = process.env.RECIPIENT_ADDRESS;
  console.log("mintRecipient", mintRecipient);

  let destinationAddressInBytes32 =
    "0x0000000000000000000000009bd44697874462a4c4c2ee7470b50b8c211bfca8";
  console.log("destinationAddressInBytes32", destinationAddressInBytes32);

  const ARBITRUM_DESTINATION_DOMAIN = 3;

  // Amount that will be transferred
  //   const amount = process.env.AMOUNT;

  // STEP 1: Approve messenger contract to withdraw from our active eth address
  const approveTxGas = await usdcBaseContract.methods
    .approve(BASE_TOKEN_MESSENGER_CONTRACT_ADDRESS, amount)
    .estimateGas();
  const approveTx = await usdcBaseContract.methods
    .approve(BASE_TOKEN_MESSENGER_CONTRACT_ADDRESS, amount)
    .send({ gas: approveTxGas });
  const approveTxReceipt = await waitForTransaction(
    web3,
    approveTx.transactionHash
  );
  console.log("ApproveTxReceipt: ", approveTxReceipt);

  // STEP 2: Burn USDC
  const burnTxGas = await ethTokenMessengerContract.methods
    .depositForBurn(
      amount,
      ARBITRUM_DESTINATION_DOMAIN,
      destinationAddressInBytes32,
      USDC_BASE_CONTRACT_ADDRESS
    )
    .estimateGas();
  const burnTx = await ethTokenMessengerContract.methods
    .depositForBurn(
      amount,
      ARBITRUM_DESTINATION_DOMAIN,
      destinationAddressInBytes32,
      USDC_BASE_CONTRACT_ADDRESS
    )
    .send({ gas: burnTxGas });
  const burnTxReceipt = await waitForTransaction(web3, burnTx.transactionHash);
  console.log("BurnTxReceipt: ", burnTxReceipt);

  // STEP 3: Retrieve message bytes from logs
  const transactionReceipt = await web3.eth.getTransactionReceipt(
    burnTx.transactionHash
  );
  const eventTopic = web3.utils.keccak256("MessageSent(bytes)");
  const log = transactionReceipt.logs.find((l) => l.topics[0] === eventTopic);
  const messageBytes = web3.eth.abi.decodeParameters(["bytes"], log.data)[0];
  const messageHash = web3.utils.keccak256(messageBytes);

  console.log(`MessageBytes: ${messageBytes}`);
  console.log(`MessageHash: ${messageHash}`);

  // STEP 4: Fetch attestation signature
  let attestationResponse = { status: "pending" };
  while (attestationResponse.status != "complete") {
    const response = await fetch(
      `https://iris-api-sandbox.circle.com/attestations/${messageHash}`
    );
    attestationResponse = await response.json();
    await new Promise((r) => setTimeout(r, 2000));
  }

  const attestationSignature = attestationResponse.attestation;
  console.log(`Signature: ${attestationSignature}`);

  // STEP 5: Using the message bytes and signature recieve the funds on destination chain and address
  web3.setProvider(process.env.ARBITRUM_TESTNET_RPC); // Connect web3 to ARBITRUM testnet
  const receiveTxGas = await arbitrumMessageTransmitterContract.methods
    .receiveMessage(messageBytes, attestationSignature)
    .estimateGas();
  const receiveTx = await arbitrumMessageTransmitterContract.methods
    .receiveMessage(messageBytes, attestationSignature)
    .send({ gas: receiveTxGas });
  const receiveTxReceipt = await waitForTransaction(
    web3,
    receiveTx.transactionHash
  );
  console.log("ReceiveTxReceipt: ", receiveTxReceipt);
};

main();
