' ME21N - Criar Pedido de Compra
' Script para abrir a transação ME21N no SAP GUI
' Uso: cscript //nologo me21n_criar_pedido.vbs

On Error Resume Next

' Conectar ao SAP GUI
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Then
    WScript.Echo "Erro: SAP GUI não está aberto"
    WScript.Quit 1
End If

Set application = SapGuiAuto.GetScriptingEngine
If application Is Nothing Then
    WScript.Echo "Erro: Não foi possível conectar ao SAP GUI"
    WScript.Quit 1
End If

If application.Children.Count = 0 Then
    WScript.Echo "Erro: Nenhuma conexão SAP ativa"
    WScript.Quit 1
End If

Set connection = application.Children(0)
If connection.Children.Count = 0 Then
    WScript.Echo "Erro: Nenhuma sessão SAP ativa"
    WScript.Quit 1
End If

Set session = connection.Children(0)

' Executar transação ME21N
session.findById("wnd[0]/tbar[0]/okcd").text = "/nME21N"
session.findById("wnd[0]").sendVKey 0

If Err.Number <> 0 Then
    WScript.Echo "Erro ao executar transação: " & Err.Description
    WScript.Quit 1
End If

WScript.Echo "Transação ME21N aberta com sucesso"
